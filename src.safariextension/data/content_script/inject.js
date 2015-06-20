/* globals background, unload */
'use strict';

var id1, id2, id3;

function check () {
  var token = /feedlyToken\"\:\"([^\"]+)/.exec(document.cookie);
  if (token && token.length) {
    background.send('token', token[1]);
    logout();
  }
  else {
    background.send('token', '');
    id1 = window.setTimeout(check, 3000);
  }
}

check();

// logout listener
function logout () {
  var span = document.querySelector('[data-app-action=askLogout]');
  if (span) {
    span.addEventListener('click', function () {
      // wait for feedly to clear cookies
      id2 = window.setTimeout(check, 3000);
    });
  }
  else {
    id3 = window.setTimeout(logout, 3000);
  }
}

// update checks
// although mutation calls are too many however, the extension prevents to run the update module more than once per 3 seconds
var observer = new MutationObserver(function () {
  background.send('update');
});

observer.observe(document, {
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true,
  attributeOldValue: true,
  characterDataOldValue: true
});

function unload () {
  observer.disconnect();
  if (id1) {
    window.clearTimeout(id1);
  }
  if (id2) {
    window.clearTimeout(id2);
  }
  if (id3) {
    window.clearTimeout(id3);
  }
}

background.receive('refresh', function () {
  var elem = document.getElementById('pageActionRefresh');
  if (elem) {
    elem.click();
  }
});
