/* globals Q, safari, config, webkitNotifications */
'use strict';

var app = new EventEmitter();
app.globals = {
  browser: 'safari'
};

app.Promise = Q.promise;
app.Promise.defer = Q.defer;

app.storage = {
  read: function (id) {
    return localStorage[id] || null;
  },
  write: function (id, data) {
    localStorage[id] = data + '';
  }
};

app.button = (function () {
  var onCommand,
      toolbarItem = safari.extension.toolbarItems[0];
  safari.application.addEventListener('command', function (e) {
    if (e.command === 'toolbarbutton' && onCommand) {
      onCommand();
    }
  }, false);

  return {
    onCommand: function (c) {
      onCommand = c;
    },
    set label (val) {
      toolbarItem.toolTip = val;
    },
    set icon (root) {
      toolbarItem.image =
        safari.extension.baseURI + 'data/' + root + '/safari/' +
        'icon.png';
    },
    set badge (val) {
      toolbarItem.badge = config.options.badge && val ? val : '';
    }
  };
})();

app.get = function (url, headers, data) {
  var xhr = new XMLHttpRequest();
  var d = new app.Promise.defer();
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

app.tab = {
  open: function (url, tab) {
    if (tab) {
      tab.url = url;
    }
    else {
      safari.application.activeBrowserWindow.openTab('foreground').url = url;
    }
  },
  list: function () {
    var wins = safari.application.browserWindows;
    var tabs = wins.map(function (win) {
      return win.tabs;
    });
    tabs = tabs.reduce(function (p, c) {
      return p.concat(c);
    }, []);
    return new app.Promise(function (a) {a(tabs);});
  },
  activate: function (tab) {
    tab.activate();
  },
  isActive: function (tab) {
    return tab === safari.application.activeBrowserWindow.activeTab;
  }
};

app.version = function () {
  return safari.extension.displayVersion;
};

app.timer = window;

app.contentScript = (function () {
  var callbacks = {};
  safari.application.addEventListener('message', function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id](e.message.data);
    }
  }, false);
  return {
    send: function (id, data, global) {
      if (global) {
        safari.application.browserWindows.forEach(function (browserWindow) {
          browserWindow.tabs.forEach(function (tab) {
            if (tab.page) {
              tab.page.dispatchMessage(id, data);
            }
          });
        });
      }
      else {
        safari.application.activeBrowserWindow.activeTab.page.dispatchMessage(id, data);
      }
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    }
  };
})();

app.options = (function () {
  var callbacks = {};
  safari.application.addEventListener('message', function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id](e.message.data);
    }
  }, false);
  return {
    send: function (id, data) {
      safari.application.browserWindows.forEach(function (browserWindow) {
        browserWindow.tabs.forEach(function (tab) {
          if (tab.page && tab.url.indexOf(safari.extension.baseURI + 'data/options/index.html') === 0) {
            tab.page.dispatchMessage(id, data);
          }
        });
      });
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    }
  };
})();

app.unload = function () {

}
