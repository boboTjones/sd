// Copyright 2020 Erin Ptacek. All rights reserved.

'use strict'

const goButton = document.getElementById('go_button')
const deleteButton = document.getElementById('delete_button')

let token; let url; let user; let teamId = ''
let pageId; let pageCount = 1
let teams = {}

const sleep = (ms) => {
    return new Promise(r => setTimeout(r, ms))
}

function htmlEscape (str, q) {
    var out = []
    out['&'] = '&amp;'
    out['<'] = '&lt;'
    out['>'] = '&gt;'

    var r

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

function formatMessages (data) {
    var str = ''
    var blob = {}
    try {
        blob = JSON.parse(data)
    } catch (e) {
        console.log(['Error parsing server response', e])
    } finally {
        if (blob.ok === true) {
            pageCount = blob.pagination.page_count

            str += '<table class="messages-table">'
            str += '<thead>'
            str += '<tr>'
            str += '<th align="left"><input type="checkbox" name="select_all"/></th>'
            str += '<th align="left">Channel</th>'
            str += '<th align="left">Message</th>'
            str += '</tr>'
            str += '</thead>'
            str += '<tbody>'

            for (const [i, item] of Object.entries(blob.items)) {
                str += '<tr>'
                for (const [l, line] of Object.entries(item.messages)) {
                    str += '<td valign="top">'
                    str += '<input type="checkbox" id=' + item.channel.id + ' name="ts" value="' + line.ts + '"/>'
                    str += '<input type="hidden" name="user" value="' + line.user + '"/>'
                    str += '</td>'
                    str += '<td valign="top">' + item.channel.id + '</td>'
                    str += '<td>' + htmlEscape(line.text, true) + '</td>'
                }
                str += '</tr>'
            }
            str += '</tbody></table>'
        }
    }

    document.getElementById('messages').innerHTML = str
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
    pageId = pageId || 1
    var req = new XMLHttpRequest()
    var postData = 'module=messages&sort=score&query=from%3a%3c@' + user + '%3e&token=' + token + '&team=' + teamId + '&page=' + pageId
    req.open('POST', url + 'api/search.modules', true)
    req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    req.onreadystatechange = function () {
        if (req.readyState === 4 && req.status === 200) {
            // XXX ToDo(erin): catch not-JSON of failed response somewhere around here.
            formatMessages(req.response)
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
        pageId += 1
    }
    getMessages()
    this.innerText = 'Delete selected'
}
