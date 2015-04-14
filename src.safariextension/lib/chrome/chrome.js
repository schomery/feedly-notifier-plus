/* globals webkitNotifications*/
'use strict';

var app = new EventEmitter();
app.globals = {
  browser: navigator.userAgent.indexOf('OPR') === -1 ? 'chrome' : 'opera'
};

app.on('load', function () {
  var script = document.createElement('script');
  document.body.appendChild(script);
  script.src = '../common.js';
});

app.Promise = Promise;

app.storage = (function () {
  var objs = {};
  chrome.storage.local.get(null, function (o) {
    objs = o;
    app.emit('load');
  });
  return {
    read: function (id) {
      return objs[id] + '';
    },
    write: function (id, data) {
      objs[id] = data;
      var tmp = {};
      tmp[id] = data;
      chrome.storage.local.set(tmp, function () {});
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
    set icon (root) {
      chrome.browserAction.setIcon({
        path: '../../data/' + root + '/24.png'
      });
    },
    set label (label) {
      chrome.browserAction.setTitle({
        title: label
      });
    },
    set badge (val) {
      chrome.browserAction.setBadgeText({
        text: config.options.badge && val ? val + '' : ''
      });
    }
  };
})();

app.get = function (url, headers, data) {
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
  xhr.open(data ? 'POST' : 'GET', url, true);
  xhr.timeout = 5000;
  for (var id in headers) {
    xhr.setRequestHeader(id, headers[id]);
  }
  if (data) {
    var arr = [];
    for (var e in data) {
      arr.push(e + '=' + data[e]);
    }
    data = arr.join('&');
  }
  xhr.send(data ? data : '');
  return d.promise;
};

app.contentScript = (function () {
  return {
    send: function (id, data, global) {
      var options = global ? {} : {active: true, currentWindow: true};
      chrome.tabs.query(options, function (tabs) {
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
  open: function (url) {
    chrome.tabs.create({
      url: url,
      active: true
    });
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
  }
};

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
};

app.timer = window;

app.options = {
  send: function (id, data) {
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach(function (tab) {
        if (tab.url.indexOf(chrome.extension.getURL('data/options/index.html') === 0)) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
        }
      });
    });
  },
  receive: function (id, callback) {
    chrome.extension.onRequest.addListener(function (request, sender) {
      if (request.method === id && sender.tab && sender.tab.url.indexOf(chrome.extension.getURL('data/options/index.html') === 0)) {
        callback(request.data);
      }
    });
  }
};
