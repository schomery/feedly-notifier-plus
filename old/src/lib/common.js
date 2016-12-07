'use strict';

  var app = app || require('./firefox/firefox');
  var config = config || require('./config');

function badge (val) {
  app.button.badge = config.options.badge && val ? val + '' : '';
}

/* feedly */
var update = (function () {
  var ck = parseInt(Math.random() * 10000000000000);
  return function () {
    var token = app.storage.read('token');
    if (token) {
      app.get(
        'https://feedly.com/v3/markers/counts?ck=' + ck + '&ct=feedly.notifier.plus&cv=' + app.version(),
        {
          'Authorization': token
        }
      ).then(function (content) {
        try {
          var json = JSON.parse(content);
          if (json.errorCode) {
            app.storage.write('token', '');
            app.emit('not-logged-in');
          }
          else {
            app.emit('logged-in');
            if (json.unreadcounts) {
              badge(json.unreadcounts.filter(function (obj) {
                return obj.id.indexOf('category/global.all') !== -1;
              }).reduce(function (p, c) {
                return p + c.count;
              }, 0));
              app.button.label = 'Feedly Notifier Plus\n\n' +
                json.unreadcounts.filter(function (obj) {
                  return obj.id.indexOf('/category/') !== -1;
                }).map(function (obj) {
                  var index = obj.id.indexOf('/category/');
                  return obj.id.substr(index).replace('/category/', 'Category: ') + ' (' + obj.count + ')';
                }).join('\n');
            }
            else {
              badge(0);
            }
          }
        }
        catch (e) {
          app.emit('not-logged-in');
        }
      });
    }
    else {
      app.emit('not-logged-in');
    }
  };
})();
update();

var refresh = (function () {
  var delay = 2000, time, id;

  return function (forced) {
    if (forced) {
      id = null;
    }
    if (id) {
      return;
    }
    var now = new Date().getTime();
    if (time && now - time < delay) {
      id = app.timer.setTimeout(refresh, delay - (now - time), true);
      return;
    }
    // console.error((new Date()).toString(), 'refreshing ...');
    time = now;
    id = null;
    update();
  };
})();

(function () {
  var id = app.timer.setInterval(refresh, config.options.period * 1000);
  app.storage.on('period', function () {
    app.timer.clearInterval(id);
    id = app.timer.setInterval(refresh, Math.max(config.options.period, 30) * 1000);
  });
})();

app.webRequest.onSendHeaders.addListener(function (details) {
  /*   Firefox                                        Chrome */
  if (('windowId' in details && details.windowId) || ('tabId' in details && details.tabId !== -1)) {
    details.requestHeaders.filter(o => o.name === 'X-Feedly-Access-Token' || o.name === 'Authorization')
      .forEach(o => app.storage.write('token', o.value));
    app.timer.setTimeout(refresh, 2000, true);
  }
}, {
  urls: ['https://feedly.com/v3/markers*']
}, ['requestHeaders']);

app.inject.receive('logged-out', () => {
  app.emit('not-logged-in');
});

app.storage.on('badge', function () {
  if (config.options.badge) {
    refresh();
  }
  else {
    badge(0);
  }
});
app.online(refresh);

// icon
(function () {
  var icon;
  app.on('logged-in', function () {
    if (icon !== 'icons') {
      app.button.icon = 'icons';
      icon = 'icons';
    }
  });
  app.on('not-logged-in', function () {
    if (icon !== 'icons/disabled') {
      app.button.icon = 'icons/disabled';
      badge(0);
      app.button.label = 'Feedly Notifier Plus (disconnected)';
      icon = 'icons/disabled';
    }
  });
})();

// button
app.button.onCommand(function () {
  // if feedly is open, just switch to it
  app.tab.list()
  .then(function (tabs) {
    for (var i in tabs) {
      var tab = tabs[i];
      if (tab.url && (tab.url.startsWith('https://feedly.com') || tab.url.startsWith('http://feedly.com'))) {
        if (app.tab.isActive(tab)) {
          app.inject.send('refresh');
        }
        else {
          app.tab.activate(tab);
        }
        return false;
      }
    }
    return true;
  })
  // if current tab is blank, load feedly in it
  .then(function (bol) {
    if (!bol) {
      return false;
    }
    return app.tab.list()
      .then(function (tabs) {
        for (var i in tabs) {
          var tab = tabs[i];
          if (['chrome://newtab/', 'about:blank', 'about:newtab'].indexOf(tab.url) !== -1 && app.tab.isActive(tab)) {
            app.tab.open('https://feedly.com', tab);
            return false;
          }
        }
        return true;
      });
  })
  .then(function (bol) {
    if (bol) {
      app.tab.open('https://feedly.com');
    }
  });
});

/* welcome page */
(function () {
  var version = config.welcome.version;
  if (app.version() !== version && config.welcome.show) {
    app.timer.setTimeout(function () {
      app.tab.open(
        'http://mybrowseraddon.com/feedly.html?v=' + app.version() +
        (version ? '&p=' + version + '&type=upgrade' : '&type=install')
      );
      config.welcome.version = app.version();
    }, config.welcome.timeout);
  }
})();
