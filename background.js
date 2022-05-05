'use strict'

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: { hostEquals: 'app.slack.com' }
      })],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }])
  })
})
