var app = new Vue({
  el: "#app",
  data: {
    processing: "Loading...",
    URLs: [],
    tab: 0
  },
  methods: {
    retry(url) {
      this.URLs.splice(url.id, 1, {
        url: url.url,
        started: false,
        finished: false,
        responses: [],
        id: url.id,
        finalURL: "",
        status: "",
        mappingRule: url.mappingRule
      });
      chrome.runtime.sendMessage({ type: "retry", url });
    },
    isMultipleTags(url) {
      return url.responses.length > 1;
    },
    is404(url) {
      return url.status === 404;
    },
    isRedirect(url) {
      let orignal = url.url.trim().replace("*", "");
      let final = url.finalURL.trim().replace("*", "");

      let urlRegex = /^(?:http(?:s)?:\/\/)?([a-zA-Z0-9-_\.]+)((?:\/[-a-zA-Z0-9%_\+.~=]+)+)?\/?(.*)?$/i;

      originalResult = urlRegex.exec(orignal);
      finalResult = urlRegex.exec(final);

      return {
        domain: { original: originalResult[1], final: finalResult[1], result: originalResult[1] !== finalResult[1] },
        path: { original: originalResult[2], final: finalResult[2], result: originalResult[2] !== finalResult[2] },
        etc: { original: originalResult[3], final: finalResult[3], result: originalResult[3] !== finalResult[3] }
      };
    },
    isMappingRuleActivated(url) {
      let ruleMatch = false;
      url.responses.forEach(response => {
        if (response.ruleHits.indexOf(url.mappingRule) > -1) {
          ruleMatch = true;
        }
      });

      return ruleMatch;
    },
    completedCount() {
      return this.URLs.filter(item => item.finished).length;
    }
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

let processing = false;

function newJobStarted(message) {
  processing = true;
  app.processing = "Processing";
  app.URLs = message.value.map(item => {
    let { url, id, mappingRule } = item;
    return { url, started: false, finished: false, responses: [], id, finalURL: "", status: "", mappingRule };
  });
}

function tabOpened(message) {
  app.URLs[message.id].started = true;
}

function tabClosed(message) {
  let finishedURL = app.URLs[message.urlId];
  finishedURL.finalURL = message.finalURL;
  finishedURL.finished = true;
}

function pageStatus(message) {
  app.URLs[message.urlId].status = message.status;
}

function jobComplete(message) {
  processing = false;
  app.processing = "Finished";
}

function responseReceived(message) {
  let responseFor = app.URLs[message.urlId];
  if (!message.response) {
    responseFor.responses.push({
      body: "no response body",
      tagId: "no response body",
      ruleHits: "no response body",
      queryString: message.queryString
    });
  }
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
