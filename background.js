chrome.runtime.onInstalled.addListener(() => {
        chrome.storage.sync.set({scripts: {}});
    });

chrome.browserAction.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});