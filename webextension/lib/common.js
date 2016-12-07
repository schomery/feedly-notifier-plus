/* globals app, config */
'use strict';

var badge = (val) => app.button.badge = config.options.badge && val ? val + '' : '';

/* updating feedly */
var update = (function () {
  let ck = parseInt(Math.random() * 10000000000000);
  return function () {
    let token = app.storage.read('token');
    //console.error('checking');
    if (token) {
      app.get(
        'https://feedly.com/v3/markers/counts?ck=' + ck + '&ct=feedly.notifier.plus&cv=' + app.version(),
        {
          'Authorization': token
        }
      ).then(function (content) {
        try {
          let json = JSON.parse(content);
          if (json.errorCode) {
            app.storage.write('token', '');
            app.emit('not-logged-in');
            //console.error(json);
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
                  let index = obj.id.indexOf('/category/');
                  return obj.id.substr(index).replace('/category/', 'Category: ') + ' (' + obj.count + ')';
                }).join('\n');
            }
            else {
              badge(0);
            }
          }
        }
        catch (e) {
          //console.error(e);
          app.emit('not-logged-in');
        }
      });
    }
    else {
      app.emit('not-logged-in');
    }
  };
})();
app.on('load', update);

var refresh = (function () {
  let delay = 2000, time, id;

  return function (forced) {
    if (forced) {
      id = null;
    }
    if (id) {
      return;
    }
    let now = new Date().getTime();
    if (time && now - time < delay) {
      id = window.setTimeout(refresh, delay - (now - time), true);
      return;
    }
    //console.error((new Date()).toString(), 'refreshing ...');
    time = now;
    id = null;
    update();
  };
})();

(function () {
  let id = window.setInterval(refresh, config.options.period * 1000);
  app.storage.on('period', function () {
    window.clearInterval(id);
    id = window.setInterval(refresh, Math.max(config.options.period, 30) * 1000);
  });
})();

app.webRequest.onSendHeaders.addListener(function (details) {
  /*   Firefox                                        Chrome */
  if (('windowId' in details && details.windowId) || ('tabId' in details && details.tabId !== -1)) {
    let token = details.requestHeaders.filter(o => o.name === 'X-Feedly-Access-Token' || o.name === 'Authorization')[0];
    if (token && token.value !== app.storage.read('token')) {
      app.storage.write('token', token.value);
      //console.error('new token');
      window.setTimeout(refresh, 2000, true);
    }
  }
}, {
  urls: ['https://feedly.com/v3/markers*']
}, ['requestHeaders']);

app.inject.receive('logged-out', () => app.emit('not-logged-in'));

app.storage.on('badge', function () {
  if (config.options.badge) {
    refresh();
  }
  else {
    badge(0);
  }
});

window.addEventListener('online', refresh, false);

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
  app.tab.list(['*://feedly.com/*'])
  .then(function (tabs) {
    for (var i in tabs) {
      var tab = tabs[i];
      if (tab.active) {
        app.inject.send('refresh');
      }
      else {
        app.tab.activate(tab);
      }
      return false;
    }
    return true;
  })
  // if current tab is blank, load feedly in it
  .then(function (bol) {
    if (!bol) {
      return false;
    }
    return app.tab.list(['chrome://newtab/', 'about:blank', 'about:newtab'])
      .then(function (tabs) {
        for (var i in tabs) {
          var tab = tabs[i];

          app.tab.open('https://feedly.com', tab);
          return false;
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
app.on('load', () => {
  var version = config.welcome.version;
  //console.error(version);
  if (app.version() !== version && config.welcome.show) {
    window.setTimeout(function () {
      app.tab.open(
        'http://mybrowseraddon.com/feedly.html?v=' + app.version() +
        (version ? '&p=' + version + '&type=upgrade' : '&type=install')
      );
      config.welcome.version = app.version();
    }, config.welcome.timeout);
  }
});
