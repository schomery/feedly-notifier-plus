'use strict';

function EventEmitter () {
  this.callbacks = {};
}
EventEmitter.prototype.on = function (name, callback) {
  this.callbacks[name] = this.callbacks[name] || [];
  this.callbacks[name].push(callback);
};
EventEmitter.prototype.emit = function (name, value) {
  (this.callbacks[name] || []).forEach(function (callback) {
    try {
      callback(value);
    }
    catch (e) {
      console.error(e);
    }
  });
};

var app = new EventEmitter();
var config = {};

app.on('load', function () {
  var script = document.createElement('script');
  document.body.appendChild(script);
  script.src = 'lib/common.js';
});

if (!Promise.defer) {
  Promise.defer = function () {
    let deferred = {};
    let promise = new Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject  = reject;
    });
    deferred.promise = promise;
    return deferred;
  };
}
app.Promise = Promise;
app.webRequest = chrome.webRequest;

app.storage = (function () {
  var objs = {};
  var callbacks = {};
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
    read: function (id) {
      return objs[id];
    },
    write: function (id, data) {
      objs[id] = data;
      var tmp = {};
      tmp[id] = data;
      chrome.storage.local.set(tmp, function () {});
    },
    on: function (id, callback) {
      callbacks[id] = callback;
    }
  };
})();

app.button = (function () {
  var onCommand;
  chrome.browserAction.onClicked.addListener(function () {
    if (onCommand) {
      onCommand();
    }
  });
  return {
    onCommand: function (c) {
      onCommand = c;
    },
    set icon (root) { //jshint ignore:line
      chrome.browserAction.setIcon({
        path: '../../data/' + root + '/24.png'
      });
    },
    set label (label) { //jshint ignore:line
      chrome.browserAction.setTitle({
        title: label
      });
    },
    set badge (val) { //jshint ignore:line
      chrome.browserAction.setBadgeText({
        text: config.options.badge && val ? val + '' : ''
      });
    }
  };
})();

app.get = function (url, headers) {
  var xhr = new XMLHttpRequest();
  var d = Promise.defer();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status !== 200) {
        d.resolve('');
      }
      else {
        d.resolve(xhr.responseText);
      }
    }
  };
  xhr.open('GET', url, true);
  xhr.timeout = 5000;
  for (var id in headers) {
    xhr.setRequestHeader(id, headers[id]);
  }
  xhr.send();
  return d.promise;
};

app.inject = (function () {
  return {
    send: function (id, data) {
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
        });
      });
    },
    receive: function (id, callback) {
      chrome.extension.onRequest.addListener(function (request, sender) {
        if (request.method === id && sender.tab) {
          callback(request.data);
        }
      });
    }
  };
})();

app.tab = {
  open: function (url, tab) {
    if (tab) {
      chrome.tabs.update(tab.tabId, {
        url: url
      });
    }
    else {
      chrome.tabs.create({
        url: url,
        active: true
      });
    }
  },
  list: function () {
    var d = app.Promise.defer();
    chrome.tabs.query({
      currentWindow: true
    }, function (tabs) {
      d.resolve(tabs);
    });
    return d.promise;
  },
  activate: function (tab) {
    chrome.tabs.update(tab.id, {
       active: true
    });
  },
  isActive: function (tab) {
    return tab.active;
  }
};

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
};

app.timer = window;

app.online = function (callback) {
  window.addEventListener('online', callback, false);
};
