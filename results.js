var app = new Vue({
  el: "#app",
  data: {
    processing: "Loading...",
    URLs: []
  }
});

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
    case "tabOpened": {
      tabOpened(message);
      break;
    }
    case "pageStatus": {
      pageStatus(message);
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
  app.processing = "Processing";
  URLs = message.value.map(item => {
    let { url, id } = item;
    return { url, started: false, finished: false, responses: [], id, finalURL: "", status: "" };
  });
  app.URLs = URLs;
}

function tabOpened(message) {
  URLs[message.id].started = true;
}

function tabClosed(message) {
  let finishedURL = URLs[message.urlId];
  finishedURL.finalURL = message.finalURL;
  finishedURL.finished = true;
}

function pageStatus(message) {
  URLs[message.urlId].status = message.status;
}

function jobComplete(message) {
  processing = false;
  app.processing = "Finished";
}

function responseReceived(message) {
  let responseFor = URLs[message.urlId];
  let ruleHits = decodeURIComponent(message.response.body)
    .split("\n")
    .find(line => line.indexOf("Rule hits:") > -1);

  let VersaTagIdRegex = /OneTagId:(\d*?),/;
  let RuleHitRegex = /Rule hits:(.*?),\s/;

  let VersaTagId = VersaTagIdRegex.exec(ruleHits);
  let MappingRules = RuleHitRegex.exec(ruleHits);

  responseFor.responses.push({
    body: message.response.body,
    tagId: VersaTagId ? VersaTagId[1] : "???",
    ruleHits: MappingRules ? MappingRules[1] : "???",
    queryString: message.queryString
  });
}
