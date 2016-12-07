/* globals chrome */
'use strict';

var background = { // jshint ignore:line
  send: (method, data) => chrome.extension.sendRequest({method, data}),
  receive: function (id, callback) {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.method === id) {
        callback(request.data);
      }
    });
  }
};
