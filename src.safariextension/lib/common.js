'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var config = require('./config');
}
/**** wrapper (end) ****/

/* options */
app.options.receive('changed', function (o) {
  config.set(o.pref, o.value);
  app.options.send('set', {
    pref: o.pref,
    value: config.get(o.pref)
  });
});
app.options.receive('get', function (pref) {
  app.options.send('set', {
    pref: pref,
    value: config.get(pref)
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
              app.button.badge = json.unreadcounts.filter(function (obj) {
                return obj.id.indexOf('category/global.all') !== -1;
              }).reduce(function (p, c) {
                return p + c.count;
              }, 0);
              app.button.label = 'Feedly Notifier Plus\n\n' +
                json.unreadcounts.filter(function (obj) {
                  return obj.id.indexOf('/category/') !== -1;
                }).map(function (obj) {
                  var index = obj.id.indexOf('/category/');
                  return obj.id.substr(index).replace('/category/', 'Category: ') + ' (' + obj.count + ')';
                }).join('\n');
            }
            else {
              app.button.badge = 0;
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
    console.error((new Date()).toString(), 'refreshing ...');
    time = now;
    id = null;
    update();
  };
})();

(function () {
  var id = app.timer.setInterval(refresh, config.options.period * 1000);
  app.on('period', function () {
    app.timer.clearInterval(id);
    id = app.timer.setInterval(refresh, config.options.period * 1000);
  });
})();

app.contentScript.receive('token', function (token) {
  app.storage.write('token', token);
  refresh();
});
app.contentScript.receive('update', function () {
  refresh();
});
app.on('badge', function () {
  console.error(config.options.badge)
  if (config.options.badge) {
    refresh();
  }
  else {
    app.button.badge = 0;
  }
});

app.on('logged-in', function () {
  app.button.icon = 'icons';
});
app.on('not-logged-in', function () {
  app.button.icon = 'icons/disabled';
  app.button.badge = 0;
  app.button.label = 'Feedly Notifier Plus (disconnected)';
});

// button
app.button.onCommand(function () {
  app.tab.list().then(function (tabs) {
    for (var i in tabs) {
      var tab = tabs[i];
      if (tab.url && (tab.url.indexOf('https://feedly.com') === 0 || tab.url.indexOf('http://feedly.com') === 0)) {
        app.tab.activate(tab);
        return false;
      }
    }
    return true;
  }).then(function (bol) {
    if (bol) {
      app.tab.open('https://feedly.com');
    }
  });
});
