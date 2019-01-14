var app = new Vue({
  el: "#app",
  data: {
    processing: "Loading...",
    URLs: [],
    tab: 0,
    versaTagId: 0,
    perPage: 50
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
        mappingRule: url.mappingRule,
        redirectOverride: -1
      });
      chrome.runtime.sendMessage({ type: "retry", url });
    },
    retryFails() {
      this.URLs.forEach(item => {
        if (item.finished && !this.isMappingRuleActivated(item)) {
          this.retry(item);
        }
      });
    },
    getIssuesText(url) {
      let text = "";
      let redirect = this.isRedirect(url);

      let noVT = url.responses && !url.responses.length;
      let noMappingRule = !this.isMappingRuleActivated(url);
      let error404 = this.is404(url);
      let multipleTags = this.isMultipleTags(url) && url.responses;
      let redirected = url.redirectOverride === -1 ? redirect.fullResult : url.redirectOverride;
      let wrongVT = !this.isVersaTagIdMatch(url) && url.responses;


      if (noVT) {
        text += `No VersaTag fired.`;
      }

      if (!noVT && !wrongVT && noMappingRule) {
        text += `Mapping Rule does not activate. `;
      }
      if (error404) {
        text += `404 Error on this URL. `;
      }
      if (!noVT && multipleTags) {
          text += `Multiple VersaTags fired on this page. The following VersaTag${url.responses.length > 0 ? 's' : ''} fired: ${url.responses
            .map(response => response.tagId)
            .join(", ")}. `;
      }
      if (redirected) {
        text += `URL redirects to: ${url.finalURL}`;
      }
      if (!noVT && !multipleTags && wrongVT) {
        text += `Wrong VersaTag fired. The following VersaTag${url.responses.length > 0 ? "s" : ""} fired: ${url.responses
          .map(response => response.tagId)
          .join(", ")}. `;
      }

      return text;
    },
    isPass(url) {
      let redirect = this.isRedirect(url);
      return (
        this.isMappingRuleActivated(url) &&
        !this.is404(url) &&
        !this.isMultipleTags(url) &&
        !(url.redirectOverride === -1 ? redirect.fullResult : url.redirectOverride) &&
        this.isVersaTagIdMatch(url)
      );
    },
    isVersaTagIdMatch(url) {
      let matches = false;
      url.responses.forEach(item => {
        if (item.tagId == this.versaTagId) {
          matches = true;
        }
      });

      return matches;
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
        fullResult:
          originalResult[1] !== finalResult[1] || originalResult[2] !== finalResult[2] || originalResult[3] !== finalResult[3],
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
  app.versaTagId = message.versaTagId;
  app.URLs = message.value.map(item => {
    let { url, id, mappingRule } = item;
    return { url, started: false, finished: false, responses: [], id, finalURL: "", status: "", mappingRule, redirectOverride: -1 };
  });
}

function tabOpened(message) {
  app.URLs[message.id].started = true;
}

function tabClosed(message) {
  let finishedURL = app.URLs[message.urlId];
  finishedURL.finalURL = message.finalURL;
  finishedURL.finished = true;

  let shouldRetry = false;

  finishedURL.responses.forEach(response => {
    if (response.ruleHits === "???" || response.ruleHits === "no response body") {
      shouldRetry = true;
    }
  });

  if (shouldRetry) {
    app.retry(finishedURL);
  }
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
  let ClientHitRegex = /Rule await client hit:(.*?),\s/;

  let VersaTagId = VersaTagIdRegex.exec(ruleHits);
  let MappingRules = RuleHitRegex.exec(ruleHits);
  let ClientHit = ClientHitRegex.exec(ruleHits);

  responseFor.responses.push({
    tagId: VersaTagId ? VersaTagId[1] : "???",
    ruleHits: MappingRules ? MappingRules[1] : "???",
    clientHit: ClientHit ? ClientHit[1] : "???",
    queryString: message.queryString
  });
}
