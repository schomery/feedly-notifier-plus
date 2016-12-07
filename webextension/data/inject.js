'use strict';

chrome.runtime.onMessage.addListener((request) => {
  if (request.method === 'refresh') {
    let elem = document.getElementById('pageActionRefresh');
    if (elem) {
      elem.click();
    }
  }
});

document.addEventListener('click', e => {
  if (e.target.dataset.appAction === 'askLogout') {
    chrome.runtime.sendMessage({
      method: 'logged-out'
    });
  }
});
