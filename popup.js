let URLsTextarea = document.getElementById("URLsTextarea");
let startButton = document.getElementById("startButton");
let stopButton = document.getElementById("stopButton");

startButton.addEventListener("click", event => {
  chrome.runtime.sendMessage({ type: "startTesting", value: URLsTextarea.value });
});

stopButton.addEventListener("click", event => {
  //
});
