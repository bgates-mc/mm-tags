let URLs = [];
let processingCount = 0;
let maxTabs = 5;
let debugListeners = {};
let completeListeners = {};
let tabList = [];

function processing() {
  return processingCount > 0 || URLs.length > 0;
}

function reset() {
  Object.keys(debugListeners).forEach(key => {
    chrome.debugger.onEvent.removeListener(debugListeners[key]);
  });
  debugListeners = {};
  Object.keys(completeListeners).forEach(key => {
    chrome.tabs.onUpdated.removeListener(completeListeners[key]);
  });
  completeListeners = {};

  URLs = [];
  processingCount = 0;
  tabList = [];
}

//Start Button handler - fires when start button is clicked.
chrome.runtime.onMessage.addListener(message => {
  if (message.type === "stopTesting") {
    reset();
    return;
  } else if (message.type === "retry") {
    URLs.push(message.url);
    if (processingCount < maxTabs) {
      openTab();
    }
  }
  if (message.type !== "startTesting") {
    return;
  }

  reset();

  if (message.maxTabs) {
    maxTabs = message.maxTabs;
  } else {
    maxTabs = 5;
  }

  URLs = message.value
    .split("\n")
    .filter(line => line)
    .map((item, index, array) => {
      if (item.indexOf("\t") > -1) {
        let [url, mappingRule] = item.split("\t");
        return { url, id: index, mappingRule };
      }

      if (index % 2 === 0) {
        return { url: item, id: index / 2, mappingRule: array[index + 1] };
      }
    })
    .filter(item => item);

  let originalURLs = URLs.slice();

  chrome.tabs.create({ url: chrome.runtime.getURL("results.html") }, tab => {
    chrome.tabs.onUpdated.addListener((updatedId, changes) => {
      if (changes.status === "complete" && updatedId === tab.id) {
        chrome.runtime.sendMessage({ type: "newJobStarted", value: originalURLs, versaTagId: message.versaTagId });
        while (URLs.length && processingCount < maxTabs) {
          openTab();
        }
      }
    });
  });
});

function openTab() {
  let item = URLs.shift();
  let { url, id } = item;
  processingCount++;
  chrome.tabs.create({ url: formatURL(url), active: false }, tab => {
    tabList.push({ tab, id: tab.id, loaded: false, pendingRequest: 0, finalURL: "", vtFired: false });
    chrome.runtime.sendMessage({ type: "tabOpened", id });
    listenForComplete(url, tab.id, id);
    attachDebugger(url, tab.id, id);
  });
}

function formatURL(url) {
  url = url.trim();
  url = url.replace("*", "");
  if (url.indexOf("http") !== 0) {
    url = `http://${url}`;
  }
  return url;
}

function listenForComplete(url, tabId, urlId) {
  completeListeners[`${tabId}CompleteListener`] = (updatedId, changes, tab) => {
    if (changes.status === "complete" && updatedId === tabId) {
      let listTab = tabList.find(item => item.id === tabId);

      if (!listTab.vtFired) {
        setTimeout(() => {
          listTab.finalURL = tab.url;
          listTab.loaded = true;
          if (!listTab.pendingRequest) {
            closeTab(url, tabId, urlId);
          }
        }, 2500);
      } else {
        listTab.finalURL = tab.url;
        listTab.loaded = true;
        if (!listTab.pendingRequest) {
          closeTab(url, tabId, urlId);
        }
      }
    }
  };
  chrome.tabs.onUpdated.addListener(completeListeners[`${tabId}CompleteListener`]);
}

function attachDebugger(url, tabId, urlId) {
  let firstRequest = true;
  let listTab = tabList.find(item => item.id === tabId);

  chrome.debugger.attach({ tabId }, "1.3", () => {
    chrome.debugger.sendCommand({ tabId }, "Network.enable");

    debugListeners[`${tabId}DebugListener`] = (debuggeeId, message, params) => {
      if (tabId !== debuggeeId.tabId) {
        return;
      }

      if (params.request && params.request.url && params.request.url.indexOf("ebOneTag.js") > -1) {
        listTab.pendingRequest++;
        listTab.vtFired;
      }

      if (
        message === "Network.responseReceived" &&
        params.response &&
        params.response.url &&
        params.response.url.indexOf("mmdebug=1") > -1 &&
        params.response.url.indexOf("cn=ot") > -1
      ) {
        chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId: params.requestId }, response => {
          chrome.runtime.sendMessage({
            type: "responseReceived",
            response,
            url,
            urlId,
            queryString: params.response.url.split("?")[1]
          });
          listTab.pendingRequest--;

          if (!listTab.pendingRequest && listTab.loaded) {
            closeTab(url, tabId, urlId);
          }
        });
      }

      if (message === "Network.responseReceived" && firstRequest) {
        chrome.runtime.sendMessage({ type: "pageStatus", status: params.response.status, urlId });
        firstRequest = false;
      }
    };

    chrome.debugger.onEvent.addListener(debugListeners[`${tabId}DebugListener`]);
  });
}

function closeTab(url, tabId, urlId) {
  let listTab = tabList.find(item => item.id === tabId);
  chrome.runtime.sendMessage({ type: "tabClosed", url, urlId, finalURL: listTab.finalURL });

  chrome.tabs.onUpdated.removeListener(completeListeners[`${tabId}CompleteListener`]);
  chrome.debugger.onEvent.removeListener(debugListeners[`${tabId}DebugListener`]);

  chrome.tabs.remove(tabId, () => {
    processingCount--;

    if (processingCount <= maxTabs && URLs.length) {
      openTab();
    } else if (URLs.length === 0 && processingCount === 0) {
      chrome.runtime.sendMessage({ type: "jobComplete" });
      debugListeners = {};
    }
  });
}

//----------Request----------

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.url.indexOf("mmdebug") === -1 && details.url.indexOf("cn=ot") > -1) {
      return { redirectUrl: `${details.url}&mmdebug=1` };
    }
  },
  { urls: ["*://bs.serving-sys.com/*"] },
  ["blocking"]
);
