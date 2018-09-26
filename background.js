let URLs = [];
let processingCount = 0;
let maxTabs = 5;
let debugListeners = {};
let completeListeners = {};

function processing() {
  return processingCount > 0 || URLs.length > 0;
}

//Start Button handler - fires when start button is clicked.
chrome.runtime.onMessage.addListener(message => {
  if (message.type === "stopTesting") {
    URLs = [];
    return;
  }
  if (message.type !== "startTesting") {
    return;
  }

  if (message.maxTabs) {
    maxTabs = message.maxTabs;
  } else {
    maxTabs = 5;
  }

  URLs = message.value.split("\n").map((item, index) => {
    return { url: item, id: index };
  });

  let originalURLs = URLs.slice();

  chrome.tabs.create({ url: chrome.runtime.getURL("results.html") }, tab => {
    chrome.tabs.onUpdated.addListener((updatedId, changes) => {
      if (changes.status === "complete" && updatedId === tab.id) {
        chrome.runtime.sendMessage({ type: "newJobStarted", value: originalURLs });
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
    chrome.runtime.sendMessage({ type: "tabOpened", id });
    listenForComplete(url, tab.id, id);
    attachDebugger(url, tab.id, id);
  });
}

function formatURL(url) {
  if (url.indexOf("http") !== 0) {
    url = `http://${url}`;
  }
  url = url.replace("*", "");
  return url;
}

function listenForComplete(url, tabId, urlId) {
  completeListeners[`${tabId}CompleteListener`] = (updatedId, changes, tab) => {
    if (changes.status === "complete" && updatedId === tabId) {
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: "tabClosed", url, urlId, finalURL: tab.url });
        chrome.tabs.onUpdated.removeListener(completeListeners[`${tabId}CompleteListener`]);

        chrome.tabs.remove(tabId, () => {
          processingCount--;

          if (processingCount <= maxTabs && URLs.length) {
            openTab();
          } else if (URLs.length === 0 && processingCount === 0) {
            chrome.runtime.sendMessage({ type: "jobComplete" });
            Object.keys(debugListeners).forEach(key => {
              chrome.debugger.onEvent.removeListener(debugListeners[key]);
            });
            debugListeners = {};
          }
        });
      }, 2500);
    }
  };
  chrome.tabs.onUpdated.addListener(completeListeners[`${tabId}CompleteListener`]);
}

function attachDebugger(url, tabId, urlId) {
  chrome.debugger.attach({ tabId }, "1.3", () => {
    chrome.debugger.sendCommand({ tabId }, "Network.enable");

    debugListeners[`${tabId}DebugListener`] = (debuggeeId, message, params) => {
      if (tabId !== debuggeeId.tabId) {
        return;
      }

      if (message == "Network.responseReceived" && params.response.url.indexOf("mmdebug=1") > -1) {
        chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId: params.requestId }, response => {
          chrome.runtime.sendMessage({
            type: "responseReceived",
            response,
            url,
            urlId,
            queryString: params.response.url.split("?")[1]
          });
        });
      }
    };

    chrome.debugger.onEvent.addListener(debugListeners[`${tabId}DebugListener`]);
  });
}

//----------Request----------
//http://www.baidu.com,http://www.tudou.com,http://www.tencent.com,https://www.landroverroaringfork.com/

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.url.indexOf("mmdebug") === -1) {
      return { redirectUrl: `${details.url}&mmdebug=1` };
    }
  },
  { urls: ["*://bs.serving-sys.com/*"] },
  ["blocking"]
);
