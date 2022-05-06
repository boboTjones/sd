// Copyright 2020 Erin Ptacek. All rights reserved.

'use strict'

const goButton = document.getElementById('go_button')
const deleteButton = document.getElementById('delete_button')

let token; let url; let user; let teamId; let chanId = ''
let teams = {}

var activeTab
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  activeTab = tabs[0]
});

function htmlEscape(str, q) {
  var out = []
  var r
  out['&'] = '&amp;'
  out['<'] = '&lt;'
  out['>'] = '&gt;'
  if (q) {
    r = /[&<>]/g
  } else {
    out['"'] = '&#34;'
    out["'"] = '&#39;'
    r = /[&<>"']/g
  }
  return ('' + str).replace(r, function (m) {
    return out[m]
  })
};

function setAttributes(element, options) {
  Object.keys(options).forEach(function (a) {
    element.setAttribute(a, options[a])
  })
}

function renderPageButtons(data) {
  // Slack API apparently doesn't let you get more than 100 pages of history.
  var pageCount = (data.page_count < 100 ? data.page_count : 100)
  var offset = 1
  var endset = 10
  var buttonDiv = document.createElement('div')
  setAttributes(buttonDiv, { class: 'pagination', id: 'page_buttons' })
  var buttonList = document.createElement('ul')
  if (data.page > 5) {
    offset = data.page - 5
    endset = data.page + 5
    var first = document.createElement('a')
    setAttributes(first, { id: '1', href: '#' })
    first.addEventListener('click', function (e) {
      getMessages(1)
    })
    first.innerHTML = '<li><<<</li>'
    buttonList.appendChild(first)
  }
  if ((pageCount - data.page) > 5) {
    endset = offset + 10
  } else {
    endset = pageCount + 1
  }
  for (var i = offset; i < endset; i++) {
    var a = document.createElement('a')
    setAttributes(a, { id: i, href: '#' })
    a.addEventListener('click', function (e) {
      getMessages(this.id)
    })
    if (i === data.page) {
      a.setAttribute('class', 'active')
    }
    a.innerHTML = '<li>' + i + '</li>'
    buttonList.appendChild(a)
  }
  if (data.page < (pageCount - 5)) {
    var last = document.createElement('a')
    setAttributes(last, { id: data.page_count, href: '#' })
    last.innerHTML = '<li>>>></li>'
    last.addEventListener('click', function (e) {
      getMessages(pageCount)
    })
    buttonList.appendChild(last)
  }
  buttonDiv.appendChild(buttonList)
  return buttonDiv
}

function renderMessages(data) {
  var blob = {}
  try {
    blob = JSON.parse(data)
  } catch (e) {
    // XX ToDo(erin): This hasn't hit yet. Probably need to put something in the messages div when it does.
    console.log(['Error parsing server response', e])
  } finally {
    if (blob.ok === true) {
      var table = document.createElement('table')
      table.setAttribute('class', 'messages-table')
      var head = table.createTHead()
      var row = head.insertRow(0);
      ['<input type="checkbox" name="select_all"/>', 'Channel ID', 'Message'].forEach(function (e, i) {
        row.insertCell(i).innerHTML = e
      })
      var body = table.createTBody()
      for (const [i, item] of Object.entries(blob.items)) {
        var row = body.insertRow(i)
        for (const [l, line] of Object.entries(item.messages)) {
          row.insertCell(0).innerHTML = '<input type="checkbox" id=' + item.channel.id + ' name="ts" value="' + line.ts + '"/>'
          row.insertCell(1).innerHTML = item.channel.id
          row.insertCell(2).innerHTML = htmlEscape(line.text, false)
        }
      }
    }
  }
  var m = document.getElementById('messages')
  m.innerHTML = ''
  m.appendChild(table, m)
  var b = renderPageButtons(blob.pagination)
  m.appendChild(b)
  var s = document.querySelector('input[name=select_all]')
  s.addEventListener('change', function (e) {
    var items = document.querySelectorAll('input[name="ts"]')
    for (const [i, item] of Object.entries(items)) {
      item.checked = s.checked
    }
  })
  deleteButton.hidden = false
  goButton.hidden = true
};

const getMessages = function (pageId = 1) {
  return new Promise(function (resolve, reject) {
    var req = new XMLHttpRequest()
    var postData = 'module=messages&sort=score&query=from%3a%3c%40' + user + '%3E%20in%3A%3C%40' + chanId + '%3e&token=' + token + '&team=' + teamId + '&page=' + pageId
    req.open('POST', url + 'api/search.modules', true)
    req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    req.onload = function (e) {
      console.log(e);
      if (req.status === 200) {
        resolve(renderMessages(req.response))
      } else {
        reject(e)
      }
    }
    req.onerror = function (e) {
      reject(console.log(e))
    }
    req.send(postData)
  })
};

function zorchMessages(id, ts) {
  var req = new XMLHttpRequest()
  var postData = 'channel=' + id + '&ts=' + ts + '&token=' + token
  req.open('POST', url + 'api/chat.delete', true)
  req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
  req.onreadystatechange = function () {
    if (req.readyState === 4 && req.status === 200) {
      // XXX ToDo(erin): catch and log errors
      console.log(req.response)
    }
  }
  req.send(postData)
};

function getLocalConfigV2(r) {
  let veetwo = localStorage.getItem("localConfig_v2");
  return veetwo;
}

goButton.onclick = function (e) {
  e.preventDefault();
  try {
    chrome.scripting.executeScript({
      target: {
        tabId: activeTab.id
      },
      func: getLocalConfigV2
    }, (o) => {
      let data = JSON.parse(o[0]["result"]);
      teams = data.teams
      teamId = activeTab.url.split("/")[4]
      chanId = activeTab.url.split("/")[5]
      url = teams[teamId].url
      token = teams[teamId].token
      user = teams[teamId].user_id
      getMessages(1)
    }
    );
  } catch (e) {
    alert(["gravity error", e])
  }
}

deleteButton.onclick = function (e) {
  e.preventDefault()
  var items = document.querySelectorAll('input[name="ts"]:checked')
  for (const [i, item] of Object.entries(items)) {
    zorchMessages(item.id, item.value)
  }
  getMessages(1)
}
