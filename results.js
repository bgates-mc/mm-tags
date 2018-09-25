chrome.runtime.onMessage.addListener(message => {
  switch (message.type) {
    case "newJobStarted": {
      newJobStarted(message);
      break;
    }
    case "tabClosed": {
      tabClosed(message);
      break;
    }
    case "jobComplete": {
      jobComplete(message);
      break;
    }
    case "responseReceived": {
      responseReceived(message);
      break;
    }
  }
});

let URLs = [];
let processing = false;

function newJobStarted(message) {
  processing = true;
  URLs = message.value.map(item => {
    let { url, id } = item;
    return { url, started: false, finished: false, responses: [], id };
  });
}

function tabClosed(message) {
  let finishedURL = URLs.find(url => url.id === message.urlId);
  finishedURL.finished = true;
}

function jobComplete(message) {
  processing = false;
  console.log("JOB FINISHED BOYZ", URLs);
}

function responseReceived(message) {
  let responseFor = URLs.find(url => url.id === message.urlId);
  responseFor.responses.push({ body: message.response.body, queryString: message.queryString });
}
