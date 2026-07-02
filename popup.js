// Copyright 2020 Erin Ptacek. All rights reserved.

'use strict'

const goButton = document.getElementById('go_button')
const deleteButton = document.getElementById('delete_button')

let token; let url; let user; let teamId; let chanId = ''
let teams = {}
let currentPage = 1

var activeTab

const getActiveTab = () => new Promise((resolve) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]))
})

// Slack endpoints. Discovery tries the documented search.messages first and
// falls back to the undocumented (but historically reliable) search.modules.
// Deletion is always chat.delete, one message per call.
const API = {
  searchMessages: 'api/search.messages',
  searchModules: 'api/search.modules',
  chatDelete: 'api/chat.delete'
}

const DELETE_DELAY_MS = 1300 // chat.delete is Tier 3 (50/min); ~46/min stays under.
const PAGE_SIZE = 20
const HISTORY_LIMIT = 200
const HISTORY_MAX_BATCHES = 20 // safety cap on the history cursor loop

let allSelfMessages = [] // the user's own messages in the current conversation

const htmlEscape = (str, q) => {
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
  return ('' + str).replace(r, (m) => {
    return out[m]
  })
}

const setAttributes = (element, options) => {
  Object.keys(options).forEach((a) => {
    element.setAttribute(a, options[a])
  })
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

const showMessage = (text) => {
  var m = document.getElementById('messages')
  m.innerHTML = '<p>' + htmlEscape(text, false) + '</p>'
}

// The search query the extension has always used: the current user's messages
// within the conversation open in the active tab. Both discovery endpoints
// understand this operator syntax.
const buildQuery = () => 'from:<@' + user + '> in:<@' + chanId + '>'

// --- Discovery -------------------------------------------------------------
// Both search endpoints are normalized to: { items: [{channelId, ts, text}],
// page, pageCount } so rendering doesn't care which one answered.

const normalizeSearchMessages = (blob) => {
  var paging = (blob.messages && blob.messages.paging) || { page: 1, pages: 1 }
  var matches = (blob.messages && blob.messages.matches) || []
  return {
    items: matches.map((m) => ({
      channelId: (m.channel && m.channel.id) || chanId,
      ts: m.ts,
      text: m.text || ''
    })),
    page: paging.page || 1,
    pageCount: paging.pages || 1
  }
}

const normalizeSearchModules = (blob) => {
  var items = []
  for (const item of Object.values(blob.items || {})) {
    var channelId = (item.channel && item.channel.id) || chanId
    for (const line of Object.values(item.messages || {})) {
      items.push({ channelId: channelId, ts: line.ts, text: line.text || '' })
    }
  }
  var pg = blob.pagination || { page: 1, page_count: 1 }
  return { items: items, page: pg.page || 1, pageCount: pg.page_count || 1 }
}

const slackPost = async (path, params) => {
  var res = await fetch(url + path, {
    method: 'POST',
    credentials: 'include', // so the browser attaches the xoxd `d` cookie
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  })
  if (res.status === 429) {
    var retryAfter = Number(res.headers.get('Retry-After') || '1')
    throw { rateLimited: true, retryAfter: retryAfter }
  }
  var blob = await res.json().catch(() => ({ ok: false, error: 'bad_json' }))
  if (blob.ok !== true) {
    throw new Error((blob && blob.error) || 'request_failed')
  }
  return blob
}

const searchViaMessages = async (pageId) => {
  var blob = await slackPost(API.searchMessages, {
    token: token,
    query: buildQuery(),
    sort: 'timestamp',
    sort_dir: 'desc',
    count: '20',
    page: String(pageId)
  })
  return normalizeSearchMessages(blob)
}

const searchViaModules = async (pageId) => {
  var blob = await slackPost(API.searchModules, {
    module: 'messages',
    sort: 'score',
    query: buildQuery(),
    token: token,
    team: teamId,
    page: String(pageId)
  })
  return normalizeSearchModules(blob)
}

// conversations.history reads the conversation directly (no search index),
// which is the reliable way to find the user's own messages — especially in
// DMs, where Slack's search returns nothing. We loop the cursor to collect the
// whole conversation, then paginate client-side.
const loadAllHistory = async () => {
  var collected = []
  var cursor = ''
  for (var b = 0; b < HISTORY_MAX_BATCHES; b++) {
    var params = { channel: chanId, token: token, limit: String(HISTORY_LIMIT) }
    if (cursor) {
      params.cursor = cursor
    }
    var blob = await slackPost('api/conversations.history', params)
    for (const mm of (blob.messages || [])) {
      // Only the user's own, ordinary messages (skip join/leave/bot subtypes).
      if (mm.user === user && !mm.subtype) {
        collected.push({ channelId: chanId, ts: mm.ts, text: mm.text || '' })
      }
    }
    cursor = (blob.response_metadata && blob.response_metadata.next_cursor) || ''
    if (!cursor) {
      break
    }
    await sleep(300)
  }
  return collected
}

const paginate = (items, pageId) => {
  var pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  var page = Math.min(Math.max(1, pageId), pageCount)
  var start = (page - 1) * PAGE_SIZE
  return { items: items.slice(start, start + PAGE_SIZE), page: page, pageCount: pageCount }
}

const getMessages = async (pageId = 1) => {
  // Primary: conversations.history (direct read, reliable for DMs). Loaded once
  // per fetch; deletions prune the cache in place.
  if (!allSelfMessages.length) {
    try {
      allSelfMessages = await loadAllHistory()
      console.debug('[deleties] conversations.history —', allSelfMessages.length, 'self messages')
    } catch (histErr) {
      console.warn('[deleties] conversations.history failed:', histErr)
    }
  }
  if (allSelfMessages.length) {
    renderMessages(paginate(allSelfMessages, pageId))
    return
  }

  // Fallbacks: documented search.messages, then internal search.modules.
  var data = null
  try {
    data = await searchViaMessages(pageId)
    console.debug('[deleties] search.messages ok —', data.items.length, 'items')
  } catch (primaryErr) {
    console.warn('[deleties] search.messages failed:', primaryErr)
  }
  if (!data || !data.items.length) {
    try {
      var fallback = await searchViaModules(pageId)
      console.debug('[deleties] search.modules ok —', fallback.items.length, 'items')
      if (!data || fallback.items.length) {
        data = fallback
      }
    } catch (fallbackErr) {
      console.error('[deleties] search.modules failed:', fallbackErr)
    }
  }
  if (!data) {
    showMessage('Could not fetch messages — history and search endpoints all failed. See the console for details.')
    return
  }
  renderMessages(data)
}

// --- Rendering -------------------------------------------------------------

const renderPageButtons = (data) => {
  // Slack apparently doesn't let you get more than 100 pages of history.
  var pageCount = Math.min(data.pageCount || 1, 100)
  var page = data.page || 1
  var offset = 1
  var endset = 10
  var buttonDiv = document.createElement('div')
  setAttributes(buttonDiv, { class: 'pagination', id: 'page_buttons' })
  var buttonList = document.createElement('ul')
  if (page > 5) {
    offset = page - 5
    var first = document.createElement('a')
    setAttributes(first, { 'data-page': '1', href: '#' })
    first.addEventListener('click', (e) => {
      e.preventDefault()
      getMessages(1)
    })
    first.innerHTML = '<li><<<</li>'
    buttonList.appendChild(first)
  }
  if ((pageCount - page) > 5) {
    endset = offset + 10
  } else {
    endset = pageCount + 1
  }
  for (var i = offset; i < endset; i++) {
    var a = document.createElement('a')
    setAttributes(a, { 'data-page': String(i), href: '#' })
    a.addEventListener('click', (e) => {
      e.preventDefault()
      getMessages(Number(e.currentTarget.getAttribute('data-page')))
    })
    if (i === page) {
      a.setAttribute('class', 'active')
    }
    a.innerHTML = '<li>' + i + '</li>'
    buttonList.appendChild(a)
  }
  if (page < (pageCount - 5)) {
    var last = document.createElement('a')
    setAttributes(last, { 'data-page': String(pageCount), href: '#' })
    last.innerHTML = '<li>>>></li>'
    last.addEventListener('click', (e) => {
      e.preventDefault()
      getMessages(pageCount)
    })
    buttonList.appendChild(last)
  }
  buttonDiv.appendChild(buttonList)
  return buttonDiv
}

const renderMessages = (data) => {
  currentPage = data.page || 1
  var m = document.getElementById('messages')
  m.innerHTML = ''

  if (!data.items.length) {
    showMessage('No messages found for this conversation.')
    return
  }

  var table = document.createElement('table')
  table.setAttribute('class', 'messages-table')
  var head = table.createTHead()
  var hrow = head.insertRow(0);
  ['<input type="checkbox" name="select_all" aria-label="Select all messages on this page"/>', 'Message'].forEach((e) => {
    var th = document.createElement('th')
    th.setAttribute('scope', 'col')
    th.innerHTML = e
    hrow.appendChild(th)
  })
  var body = table.createTBody()
  data.items.forEach((item) => {
    var r = body.insertRow()
    r.insertCell(0).innerHTML = '<input type="checkbox" class="ts-box" aria-label="Select message" data-channel="' + htmlEscape(item.channelId, false) + '" value="' + htmlEscape(item.ts, false) + '"/>'
    r.insertCell(1).innerHTML = htmlEscape(item.text, false)
  })

  m.appendChild(table)
  m.appendChild(renderPageButtons(data))

  var s = document.querySelector('input[name=select_all]')
  s.addEventListener('change', () => {
    document.querySelectorAll('input.ts-box').forEach((box) => {
      box.checked = s.checked
    })
  })
  deleteButton.hidden = false
  goButton.hidden = true
}

// --- Deletion --------------------------------------------------------------
// chat.delete takes exactly one channel + ts per call; there is no batch
// endpoint. So we loop, spacing calls out and backing off on 429.

const zorchMessage = async (channelId, ts) => {
  return slackPost(API.chatDelete, { channel: channelId, ts: ts, token: token })
}

// --- Config scraping -------------------------------------------------------
// Injected into the page's MAIN world so it reads the Slack tab's real
// localStorage (the extension's isolated world has its own, empty storage).

const getLocalConfigV2 = () => {
  return localStorage.getItem('localConfig_v2')
}

goButton.onclick = async (e) => {
  e.preventDefault()
  try {
    activeTab = await getActiveTab()
    if (!activeTab || !activeTab.id) {
      showMessage('No active tab found. Open a Slack conversation and try again.')
      return
    }
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      world: 'MAIN',
      func: getLocalConfigV2
    }, (o) => {
      if (!o || !o[0] || !o[0].result) {
        showMessage('Could not read Slack config from this tab. Open a Slack conversation and try again.')
        return
      }
      var data
      try {
        data = JSON.parse(o[0].result)
      } catch (err) {
        showMessage('Could not parse Slack config from this tab.')
        return
      }
      teams = data.teams
      teamId = activeTab.url.split('/')[4]
      chanId = activeTab.url.split('/')[5]
      if (!teams || !teams[teamId]) {
        showMessage('No Slack workspace found for this tab.')
        return
      }
      url = teams[teamId].url
      token = teams[teamId].token
      user = teams[teamId].user_id
      allSelfMessages = [] // fresh fetch: drop any cache from a prior channel
      getMessages(1)
    })
  } catch (err) {
    showMessage('Could not start: ' + err)
  }
}

deleteButton.onclick = async (e) => {
  e.preventDefault()
  var boxes = Array.from(document.querySelectorAll('input.ts-box:checked'))
  if (!boxes.length) {
    return
  }
  deleteButton.disabled = true
  var deletedTs = []
  for (const box of boxes) {
    var channelId = box.getAttribute('data-channel')
    var ts = box.value
    var done = false
    while (!done) {
      try {
        await zorchMessage(channelId, ts)
        deletedTs.push(ts)
        done = true
      } catch (err) {
        if (err && err.rateLimited) {
          console.warn('[deleties] rate limited; backing off ' + err.retryAfter + 's')
          await sleep((err.retryAfter + 1) * 1000)
        } else {
          console.error('[deleties] delete failed for ts=' + ts + ':', err)
          done = true // give up on this one, move on
        }
      }
    }
    await sleep(DELETE_DELAY_MS)
  }
  deleteButton.disabled = false

  // Prune successfully deleted messages from the cache and re-render.
  if (deletedTs.length && allSelfMessages.length) {
    var gone = new Set(deletedTs)
    allSelfMessages = allSelfMessages.filter((it) => !gone.has(it.ts))
    getMessages(currentPage)
  } else {
    getMessages(currentPage + 1)
  }
}
