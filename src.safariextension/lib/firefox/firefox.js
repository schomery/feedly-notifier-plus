'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    buttons       = require('sdk/ui/button/action'),
    Request       = require('sdk/request').Request,
    prefs         = sp.prefs,
    pageMod       = require('sdk/page-mod'),
    tabs          = require('sdk/tabs'),
    timers        = require('sdk/timers'),
    loader        = require('@loader/options'),
    array         = require('sdk/util/array'),
    unload        = require('sdk/system/unload'),
    {on, off, once, emit} = require('sdk/event/core'),
    {Cc, Ci, Cu}  = require('chrome'),
    tbExtra       = require('./tbExtra'),
    config        = require('../config');

Cu.import('resource://gre/modules/Promise.jsm');

// Promise
exports.Promise = Promise;

// Event Emitter
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.emit = emit.bind(null, exports);
exports.removeListener = function removeListener (type, listener) {
  off(exports, type, listener);
};

//toolbar button
exports.button = (function () {
  var onClick;
  var button = buttons.ActionButton({
    id: self.name,
    label: 'Feedly Notifier Plus',
    icon: {
      '24': './icons/disabled/24.png',
      '32': './icons/disabled/32.png'
    },
    onClick: function() {
      if (onClick) {
        onClick();
      }
    }
  });
  tbExtra.setButton(button);
  return {
    onCommand: function (c) {
      onClick = c;
    },
    set label (val) {
      button.label = val;
    },
    set badge (val) {
      tbExtra.setBadge(config.options.badge ? val : '');
    },
    set icon (root) {
      button.icon = {
        '24': './' + root + '/24.png',
        '32': './' + root + '/32.png',
        '64': './' + root + '/64.png'
      };
    }
  };
})();

exports.contentScript = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: ['http://feedly.com/*', 'https://feedly.com/*'],
    contentScriptFile: [data.url('./content_script/firefox/firefox.js'), data.url('./content_script/inject.js')],
    contentScriptWhen: 'start',
    attachTo: ['top', 'existing'],
    contentScriptOptions: {
      globals: exports.globals
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data, global) {
      workers.forEach(function (worker) {
        if (!global && worker.tab !== tabs.activeTab) {
          return;
        }
        if (!worker) {
          return;
        }
        worker.port.emit(id, data);
      });
    },
    receive: function (id, callback) {
      content_script_arr.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + '' === 'false' || !isNaN(prefs[id])) ? (prefs[id] + '') : null;
  },
  write: function (id, data) {
    data = data + '';
    if (data === 'true' || data === 'false') {
      prefs[id] = data === 'true' ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + '';
    }
  }
};

exports.get = function (url, headers, data) {
  headers = headers || {};

  var d = new Promise.defer();
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
  if (data) {
    var arr = [];
    for(var e in data) {
      arr.push(e + '=' + data[e]);
    }
    data = arr.join('&');
  }
  req.send(data ? data : '');
  return d.promise;
};

exports.tab = {
  open: function (url) {
    tabs.open({
      url: url
    });
  },
  list: function () {
    var temp = [];
    for each (var tab in tabs) {
      temp.push(tab);
    }
    return Promise.resolve(temp);
  },
  activate: function (tab) {
    tab.activate();
  }
};

exports.version = function () {
  return self.version;
};

exports.timer = timers;

exports.options = (function () {
  var workers = [], options_arr = [];
  pageMod.PageMod({
    include: data.url('options/index.html'),
    contentScriptFile: data.url('options/index.js'),
    contentScriptWhen: 'start',
    contentScriptOptions: {
      base: loader.prefixURI + loader.name + '/'
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', (w) => array.add(workers, w));
      worker.on('pagehide', (w) => array.remove(workers, w));
      worker.on('detach', (w) => array.remove(workers, w));

      options_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data) {
      workers.forEach(function (worker) {
        if (!worker || !worker.url) {
          return;
        }
        worker.port.emit(id, data);
      });
    },
    receive: (id, callback) => options_arr.push([id, callback])
  };
})();

sp.on('openOptions', function() {
  exports.tab.open(data.url('options/index.html'));
});
unload.when(function () {
  exports.tab.list().then(function (tabs) {
    tabs.forEach(function (tab) {
      if (tab.url === data.url('options/index.html')) {
        tab.close();
      }
    });
  });
});
