// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

let goButton = document.getElementById('goButton');
let deleteButton = document.getElementById('deleteButton');
let token, url, user = '';

function htmlEscape(str, noQuotes) {
  var map = [];
  map['&'] = '&amp;';
  map['<'] = '&lt;';
  map['>'] = '&gt;';

  var regex;

  if (noQuotes) {
    regex = /[&<>]/g;
  }
  else {
    map['"'] = '&#34;';
    map["'"] = '&#39;';
    regex = /[&<>"']/g;
  }

  return ('' + str).replace(regex, function(match) {
    return map[match];
  });
}

function formatMessages(data) {
  var str = '';
  var blob = {};
  try {
    blob = JSON.parse(data);
  }
  catch(e) {
    console.log(["Error parsing server response", e]);
  }
  finally {
    if ( blob['ok'] === true ) {
      str += '<table class="messages-table">';
      str += '<thead>';
      str += '<tr>';
      // XX ToDo(erin): put a selectAll button here.
      str += '<th align="left">&nbsp;</th>';
      str += '<th align="left">Channel</th>';
      str += '<th align="left">Message</th>';
      str += '</tr>';
      str += '</thead>';
      str += '<tbody>';
      
      for ( let [i, item] of Object.entries(blob['items']) ) {
        str += '<tr>';
        for ( let [l, line] of Object.entries(item['messages']) ) {
          str += '<td>';
          str += '<input type="checkbox" id=' + item['channel']['id'] + ' name="ts" value="' + line['ts']  + '"/>';
          str += '<input type="hidden" name="user" value="' + line['user']  + '"/>';
          str += '</td>';
          str += '<td>' + item['channel']['id'] + '</td>';
          str += '<td>' + htmlEscape(line['text'], true) + '</td>';
        }
        str += '</tr>';
      }
      str += '</tbody></table>';
    }
  }
  document.getElementById("messages").innerHTML = str;
  document.getElementById("deleteButton").hidden = false;
  document.getElementById("goButton").hidden = true;
}

function getMessages(user, teamId) {
  var req = new XMLHttpRequest();
  var postData = 'module=messages&max_extract_len=9999&sort=score&query=from%3a%3c@' + user + '%3e&token=' + token + '&team=' + teamId
  req.open("POST", url + 'api/search.modules', true);
  req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  req.onreadystatechange = function () {
    if (req.readyState === 4 && req.status === 200) {
      // XX ToDo(erin): catch not-JSON of failed response somewhere around here.
      formatMessages(req.response);
    }
  };
  req.send(postData);
}

function zorch(id, ts) {
  var req = new XMLHttpRequest();
  var postData = 'channel=' + id  + '&ts=' + ts + '&token=' + token;
  req.open('POST', url + 'api/chat.delete', true);
  req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  req.onreadystatechange = function () {
    if (req.readyState === 4 && req.status === 200) {
      // XX ToDo(erin): catch and log errors
     console.log(req.response);
    }
  };
  req.send(postData);
}

goButton.onclick = function(e) {
  e.preventDefault();
  chrome.tabs.executeScript({code: 'localStorage.getItem("localConfig_v2")'}, function(r) { 
    let data = JSON.parse(r[0]);
    var teamId = data['lastActiveTeamId'];
    var teams = data['teams'];
    url = teams[teamId]['url'];
    token = teams[teamId]['token'];
    user = teams[teamId]['user_id'];
    getMessages(user, teamId);
  });
};

deleteButton.onclick = function(e) {
  var items;
  e.preventDefault();
  items = document.querySelectorAll('input[name="ts"]:checked');
  for ( let [i, item] of Object.entries(items) ) {
    zorch(item.id, item.value);
  }
}
