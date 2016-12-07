'use strict';

var app = app || require('./firefox/firefox');
var config = config || exports;

config.options = {
  get period () {
    return +app.storage.read('period') || 900;  // default value is 15 minutes
  },
  set period (val) {
    val = +val;
    val = Math.max(val, 30);
    app.storage.write('period', val);
    app.emit('period');
  },
  get badge () {
    return app.storage.read('badge') === false ? false : true; // default is true
  },
  set badge (val) {
    app.storage.write('badge', val);
    app.emit('badge');
  }
};

config.welcome = {
  get version () {
    return app.storage.read('version');
  },
  set version (val) {
    app.storage.write('version', val);
  },
  timeout: 3,
  get show () {
    return app.storage.read('show') === false ? false : true; // default is true
  },
  set show (val) {
    app.storage.write('show', val);
  }
};
