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

  URLs = message.value.split(",").map((item, index) => {
    return { url: item, id: index };
  });

  let originalURLs = URLs.slice();

  chrome.tabs.create({ url: chrome.runtime.getURL("results.html") }, () => {
    chrome.runtime.sendMessage({ type: "newJobStarted", value: originalURLs });
  });

  while (URLs.length && processingCount < maxTabs) {
    openTab();
  }
});

function openTab() {
  let item = URLs.shift();
  let { url, id } = item;
  processingCount++;
  chrome.tabs.create({ url, active: false }, tab => {
    listenForComplete(url, tab.id, id);
    attachDebugger(url, tab.id, id);
  });
}

function listenForComplete(url, tabId, urlId) {
  completeListeners[`${tabId}CompleteListener`] = (updatedId, changes, tab) => {
    if (changes.status === "complete" && updatedId === tabId) {
      chrome.runtime.sendMessage({ type: "tabClosed", url, urlId });
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

/*
https://www.landroverroaringfork.com/
 VersaTag ID: 4497
 Mapping rule 170448 activates.
 query string is: cn=ottest&onetagid=4497&dispType=js&sync=0&sessionid=5435238755290978693&pageurl=$$https://www.landroverroaringfork.com/$$&activityValues=$$Session=5696495043623395387$$&acp=$$step=&cpo=$$&ns=0&rnd=9636598558389784&mmdebug=1
 %0A
 */
