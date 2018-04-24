chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get("list", data => {
    if (!data.list) {
      chrome.storage.sync.set({
        list: [
          {
            keybind: { keyCode: -1, keyName: "On Page Load" },
            site: "",
            script: "console.log('Hello World');"
          }
        ]
      });
    }
  });
});

chrome.browserAction.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
