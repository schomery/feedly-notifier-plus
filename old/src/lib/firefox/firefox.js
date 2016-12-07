'use strict';

// Load Firefox based resources
var self = require('sdk/self'),
    data = self.data,
    sp = require('sdk/simple-prefs'),
    buttons = require('sdk/ui/button/action'),
    prefs = sp.prefs,
    pageMod = require('sdk/page-mod'),
    tabs = require('sdk/tabs'),
    timers = require('sdk/timers'),
    array = require('sdk/util/array'),
    unload = require('sdk/system/unload'),
    {on, emit} = require('sdk/event/core'),
    {Cc, Ci, Cu}  = require('chrome'),
    {defer, resolve}  = require('sdk/core/promise');

var nsIObserverService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
var {WebRequest} = Cu.import('resource://gre/modules/WebRequest.jsm');
var {MatchPattern} = Cu.import('resource://gre/modules/MatchPattern.jsm');

exports.webRequest = {
  onSendHeaders: {
    addListener: function (listener, mtch, options) {
      let pattern = new MatchPattern(mtch.urls);
      WebRequest.onSendHeaders.addListener(listener, {
        urls: pattern
      }, options);
      unload.when(() => WebRequest.onSendHeaders.removeListener(listener));
    }
  }
};

// Event Emitter
exports.on = on.bind(null, exports);
exports.emit = emit.bind(null, exports);

//toolbar button
exports.button = (function () {
  let onClick = function () {};
  let button = buttons.ActionButton({
    id: self.name,
    label: 'Feedly Notifier Plus',
    icon: {
      '24': './icons/disabled/24.png',
      '32': './icons/disabled/32.png'
    },
    onClick: () => onClick()
  });
  return {
    onCommand: (c) => onClick = c,
    set label (val) { // jshint ignore:line
      button.label = val;
    },
    set badge (val) { // jshint ignore:line
      button.badge = val;
    },
    set icon (root) { // jshint ignore:line
      button.icon = {
        '24': './' + root + '/24.png',
        '32': './' + root + '/32.png',
        '64': './' + root + '/64.png'
      };
    }
  };
})();

exports.inject = (function () {
  let workers = [], callbacks = [];
  pageMod.PageMod({
    include: ['http://feedly.com/*', 'https://feedly.com/*'],
    contentScriptFile: [
      data.url('./content_script/firefox/firefox.js'),
      data.url('./content_script/inject.js')
    ],
    contentScriptWhen: 'start',
    attachTo: ['top', 'existing'],
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      callbacks.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data) {
      workers.forEach(worker => worker.port.emit(id, data));
    },
    receive: function (id, callback) {
      callbacks.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();

exports.storage = {
  read: id => prefs[id],
  write: (id, data) => prefs[id] = data,
  on: (id, callback) => sp.on(id, callback)
};
sp.on('period', () => {
  timers.setTimeout(() => {
    prefs.period = Math.max(prefs.period, 30);
  }, 2000);
});

exports.get = function (url, headers) {
  headers = headers || {};

  var d = defer();
  var req = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
    .createInstance(Ci.nsIXMLHttpRequest);

  req.open('GET', url, true);
  req.timeout = 5000;
  for (var id in headers) {
    req.setRequestHeader(id, headers[id]);
  }
  req.onreadystatechange = function () {
    if (req.readyState === 4) {
      d.resolve(req.responseText);
    }
  };
  req.send();
  return d.promise;
};

exports.tab = {
  open: function (url, tab) {
    if (tab) {
      tab.url = url;
    }
    else {
      tabs.open({url});
    }
  },
  list: function () {
    let temp = [];
    for each (let tab in tabs) {
      temp.push(tab);
    }
    return resolve(temp);
  },
  activate: (tab) => tab.activate(),
  isActive: (tab) => tabs.activeTab === tab
};

exports.version = () => self.version;

exports.timer = timers;

exports.online = (function () {
  let callback = function () {};
  let listen = {
    observe: function (subject, topic, data) {
      if (data === 'online') {
        callback();
      }
    }
  };
  nsIObserverService.addObserver(listen, 'network:offline-status-changed', false);
  unload.when(function () {
    nsIObserverService.removeObserver(listen, 'network:offline-status-changed');
  });
  return function (c) {
    callback = c;
  };
})();

exports.unload = (c) => unload.when(c);
