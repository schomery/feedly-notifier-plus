/* globals background */
'use strict';

background.receive('refresh', function () {
  var elem = document.getElementById('pageActionRefresh');
  if (elem) {
    elem.click();
  }
});
document.addEventListener('click', e => {
  if (e.target.dataset.appAction === 'askLogout') {
    background.send('logged-out');
  }
});
