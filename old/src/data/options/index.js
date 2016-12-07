'use strict';

// Saves options to chrome.storage
function save_options() {
  var badge = document.getElementById('badge').checked;
  var show = document.getElementById('show').checked;
  var period = document.getElementById('period').value;

  period = Math.max(period, 30);
  document.getElementById('period').value = period;

  chrome.storage.local.set({
    badge,
    show,
    period
  }, function () {
    var status = document.getElementById('status');
    status.textContent = 'Options are saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
    chrome.runtime.sendMessage('prefs-updated');
  });
}

function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.local.get({
    badge: true,
    period: 900,
    show: true
  }, function(items) {
    document.getElementById('badge').checked = items.badge;
    document.getElementById('show').checked = items.show;
    document.getElementById('period').value = items.period;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
