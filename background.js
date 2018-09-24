let URLs = [];
let tabs = [];
let processingCount = 0;
let maxTabs = 5;

//Start Button handler - fires when start button is clicked.
chrome.runtime.onMessage.addListener(message => {
  if (message.type !== "startTesting") {
    return;
  }

  chrome.tabs.create({ url: chrome.runtime.getURL("results.html") }, () => {
    chrome.runtime.sendMessage({ type: "newJobStarted", value: message.value.split(",") });
  });

  URLs = message.value.split(",");

  while (URLs.length && processingCount < maxTabs) {
    openTab();
  }
});

//Tab Closed Handler - fires when one of the tabs finishes loading.
chrome.tabs.onUpdated.addListener((tabID, changes, tab) => {
  let tabIndex = tabs.indexOf(tabID);

  if (changes.status === "complete" && tabIndex > -1) {
    chrome.runtime.sendMessage({ type: "tabClosed", url: tab.url });

    chrome.tabs.remove(tabID, () => {
      processingCount--;
      tabs.splice(tabIndex, 1);

      if (processingCount <= maxTabs && URLs.length) {
        openTab();
      } else if (URLs.length === 0 && processingCount === 0) {
        chrome.runtime.sendMessage({ type: "jobComplete" });
      }
    });
  }
});

function openTab() {
  processingCount++;
  chrome.tabs.create({ url: URLs.shift(), active: false }, tab => {
    tabs.push(tab.id);
  });
}

//----------Request----------
//http://www.baidu.com, http://www.tudou.com, http://www.tencent.com

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.url.indexOf("mmdebug") === -1) {
      console.log("We got a live one here: ", details);
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
*/
