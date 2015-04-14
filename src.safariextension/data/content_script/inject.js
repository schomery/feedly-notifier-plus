/* globals background */
/* globals background */
'use strict';

function check () {
  var token = /feedlyToken\"\:\"([^\"]+)/.exec(document.cookie);
  if (token && token.length) {
    background.send('token', token[1]);
    logout();
  }
  else {
    background.send('token', '');
    window.setTimeout(check, 3000);
  }
}

check();

// logout listener
function logout () {
  var span = document.querySelector('[data-app-action=askLogout]');
  if (span) {
    span.addEventListener('click', function () {
      // wait for feedly to clear cookies
      window.setTimeout(check, 3000);
    });
  }
  else {
    window.setTimeout(logout, 3000);
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
