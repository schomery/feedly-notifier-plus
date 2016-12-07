'use strict';

function EventEmitter () {
  this.callbacks = {};
}
EventEmitter.prototype.on = function (name, callback) {
  this.callbacks[name] = this.callbacks[name] || [];
  this.callbacks[name].push(callback);
};
EventEmitter.prototype.emit = function (name, value) {
  (this.callbacks[name] || []).forEach(c => c(value));
};

var app = new EventEmitter();

app.webRequest = chrome.webRequest;

app.storage = (function () {
  let objs = {};
  let callbacks = {};
  chrome.storage.local.get(null, function (o) {
    objs = o;
    app.emit('load');
  });

  chrome.runtime.onMessage.addListener(function (request) {
    if (request === 'prefs-updated') {
      chrome.storage.local.get(null, function (o) {
        for (let name in o) {
          if (o[name] !== objs[name] && callbacks[name]) {
            objs[name] = o[name];
            callbacks[name]();
          }
        }
      });
    }
  });

  return {
    read: (id) => objs[id],
    write: (id, data) => {
      objs[id] = data;
      chrome.storage.local.set({[id]: data});
    },
    on: (id, callback) => callbacks[id] = callback
  };
})();

app.button = (function () {
  let onCommand = function () {};
  chrome.browserAction.onClicked.addListener(() => onCommand());
  return {
    onCommand: (c) => onCommand = c,
    set icon (root) { //jshint ignore:line
      chrome.browserAction.setIcon({
        path: {
          16: '../../data/' + root + '/16.png',
          24: '../../data/' + root + '/24.png',
          32: '../../data/' + root + '/32.png',
          48: '../../data/' + root + '/48.png',
          64: '../../data/' + root + '/64.png'
        }
      });
    },
    set label (title) { //jshint ignore:line
      chrome.browserAction.setTitle({title});
    },
    set badge (text) { //jshint ignore:line
      chrome.browserAction.setBadgeText({text});
    }
  };
})();

app.get = function (url, headers) {
  return new Promise((resolve) => {
    var xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () => resolve('');
    xhr.open('GET', url, true);
    xhr.timeout = 5000;
    for (let id in headers) {
      xhr.setRequestHeader(id, headers[id]);
    }
    xhr.send();
  });
};

app.inject = (function () {
  return {
    send: function (method, data) {
      chrome.tabs.query({
        url: ['*://feedly.com/*']
      }, tabs => tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, {method, data})));
    },
    receive: function (id, callback) {
      chrome.runtime.onMessage.addListener((request, sender) => {
        if (request.method === id && sender.tab) {
          callback(request.data);
        }
      });
    }
  };
})();

app.tab = {
  open: (url, tab) => {
    if (tab) {
      chrome.tabs.update(tab.tabId, {url});
    }
    else {
      chrome.tabs.create({url});
    }
  },
  list: (url = []) => new Promise((resolve) => {
    chrome.tabs.query({
      currentWindow: true,
      url
    }, (tabs) => resolve(tabs));
  }),
  activate: (tab) => chrome.tabs.update(tab.id, {
    active: true
  })
};

app.version = () => chrome.runtime.getManifest().version;
