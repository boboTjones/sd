// Copyright 2020 Erin Ptacek. All rights reserved.

'use strict'

const goButton = document.getElementById('go_button')
const deleteButton = document.getElementById('delete_button')

let token; let url; let user; let teamId = ''
let teams; let pagination = {}

function htmlEscape (str, q) {
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

function renderPageButtons () {
    let buttonDiv = document.createElement('div'); 
    buttonDiv.setAttribute('id', 'page_buttons');
    ['first', 'fwd', 'back', 'last'].forEach(function(e, i) {
        var b = document.createElement('button')
        b.setAttribute('id', e)
        b.innerHTML = e
        buttonDiv.appendChild(b)
    })
    return buttonDiv
}

function renderMessages (data) {
    var blob = {}
    try {
        blob = JSON.parse(data)
        pagination = blob.pagination
    } catch (e) {
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
    m.innerHTML = '';
    m.appendChild(table, m)
    var b = renderPageButtons()
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

function getMessages () {
    const pageId = pagination.pageId || 1
    var req = new XMLHttpRequest()
    var postData = 'module=messages&sort=score&query=from%3a%3c@' + user + '%3e&token=' + token + '&team=' + teamId + '&page=' + pageId

    req.open('POST', url + 'api/search.modules', true)
    req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    req.onreadystatechange = function () {
        if (req.readyState === 4 && req.status === 200) {
            // XXX ToDo(erin): catch not-JSON of failed response somewhere around here.
            renderMessages(req.response)
        }
    }
    req.send(postData)
};

function zorchMessages (id, ts) {
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

goButton.onclick = function (e) {
    e.preventDefault()
    chrome.tabs.executeScript({ code: 'localStorage.getItem("localConfig_v2")' }, function (r) {
        const data = JSON.parse(r[0])
        teams = data.teams
        teamId = data.lastActiveTeamId
        url = teams[teamId].url
        token = teams[teamId].token
        user = teams[teamId].user_id
        getMessages()
    })
}

deleteButton.onclick = function (e) {
    e.preventDefault()
    this.innerText = 'Deleting...'
    var items = document.querySelectorAll('input[name="ts"]:checked')
    for (const [i, item] of Object.entries(items)) {
        // XXX ToDo(erin): maybe want to slap an ARE YOU SURE? on this.
        zorchMessages(item.id, item.value)
        // random sleep to thwart throttling?
        // sleep(Math.random() * 100)
    }
    var s = document.querySelector('input[name=select_all]')
    if (s.checked) {
        pagination.page += 1
    }
    getMessages()
    this.innerText = 'Delete selected'
}
