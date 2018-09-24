let URLs = document.getElementById("URLs");

chrome.runtime.onMessage.addListener(function(message) {
  if (message.type !== "tabClosed") {
    return;
  }
  URLs.innerHTML = `URLs in the queue: \n${message.URLs}`;
});
