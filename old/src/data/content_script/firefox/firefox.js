/* globals self */
'use strict';

var background = { // jshint ignore:line
  receive: self.port.on,
  send: self.port.emit
};
