let URLsTextarea = document.getElementById("URLsTextarea");
let startButton = document.getElementById("startButton");
let stopButton = document.getElementById("stopButton");

startButton.addEventListener("click", event => {
  chrome.runtime.sendMessage({ type: "startTesting", value: URLsTextarea.value });
});

stopButton.addEventListener("click", event => {
  chrome.runtime.sendMessage({ type: "stopTesting" });
});

chrome.runtime.getBackgroundPage(processor => {
  let { processing } = processor;
  if (processing()) {
    stopButton.removeAttribute("disabled");
  } else {
    startButton.removeAttribute("disabled");
  }
});
