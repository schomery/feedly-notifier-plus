/* globals self, unload */
'use strict';

var background = {
  send: function (id, data) {
    self.port.emit(id, data);
  },
  receive: function (id, callback) {
    self.port.on(id, callback);
  }
};

var manifest = {
  url: self.options.base
};

var globals = self.options.globals;

self.port.on('detach', function () {
  if (unload) {
    unload();
  }
});
