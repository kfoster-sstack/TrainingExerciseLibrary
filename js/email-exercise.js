/* ============================================================
   Email Exercise - Standalone script for individual exercise pages
   Handles Klaviyo subscription + exercise email event tracking
   ============================================================ */
(function () {
  'use strict';

  var KLAVIYO_COMPANY_ID = window.TEL_KLAVIYO_COMPANY_ID || 'WbH6Ey';
  var KLAVIYO_LIST_ID = window.TEL_KLAVIYO_LIST_ID || 'WyrPPe';
  var emailCaptured = localStorage.getItem('tel_email') || '';

  function subscribeToKlaviyo(email, name, source) {
    if (!KLAVIYO_COMPANY_ID || !KLAVIYO_LIST_ID) return;

    var profileAttrs = {
      email: email,
      properties: {
        'Lead Source': source || 'training_exercise_library',
        'Signup Date': new Date().toISOString()
      }
    };
    if (name) profileAttrs.first_name = name;

    fetch('https://a.klaviyo.com/client/subscriptions/?company_id=' + KLAVIYO_COMPANY_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'revision': '2024-10-15' },
      body: JSON.stringify({
        data: {
          type: 'subscription',
          attributes: {
            custom_source: 'Training Exercise Library',
            profile: { data: { type: 'profile', attributes: profileAttrs } }
          },
          relationships: { list: { data: { type: 'list', id: KLAVIYO_LIST_ID } } }
        }
      })
    }).catch(function () {});
  }

  function trackExerciseEvent(email, exerciseData) {
    if (!KLAVIYO_COMPANY_ID) return;

    fetch('https://a.klaviyo.com/client/events/?company_id=' + KLAVIYO_COMPANY_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'revision': '2024-10-15' },
      body: JSON.stringify({
        data: {
          type: 'event',
          attributes: {
            properties: exerciseData,
            metric: {
              data: { type: 'metric', attributes: { name: 'Requested Exercise Email' } }
            },
            profile: {
              data: { type: 'profile', attributes: { email: email } }
            }
          }
        }
      })
    }).catch(function () {});
  }

  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  function getExerciseData() {
    var el = document.getElementById('exerciseData');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  function sendExercise(email, name) {
    var data = getExerciseData();
    if (!data) return;

    subscribeToKlaviyo(email, name, 'exercise_email');
    trackExerciseEvent(email, data);
    showToast('Exercise sent to ' + email + '!', 'success');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('btnEmailExercise');
    var modal = document.getElementById('emailExerciseModal');
    var form = document.getElementById('emailExerciseForm');
    if (!btn || !modal || !form) return;

    btn.addEventListener('click', function () {
      if (emailCaptured) {
        btn.disabled = true;
        btn.textContent = 'Sending...';
        sendExercise(emailCaptured, localStorage.getItem('tel_user_name') || '');
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Sent!';
        setTimeout(function () {
          btn.disabled = false;
          btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg> Email Me This Exercise';
        }, 3000);
        return;
      }
      modal.classList.add('active');
    });

    modal.querySelector('.modal-close').onclick = function () { modal.classList.remove('active'); };
    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) modal.classList.remove('active');
    });

    form.onsubmit = function (ev) {
      ev.preventDefault();
      var hp = document.getElementById('emailExHp');
      if (hp && hp.value) return;

      var name = document.getElementById('emailExName').value.trim();
      var email = document.getElementById('emailExEmail').value.trim();
      if (!email) return;

      emailCaptured = email;
      localStorage.setItem('tel_email', email);
      if (name) localStorage.setItem('tel_user_name', name);

      modal.classList.remove('active');

      btn.disabled = true;
      btn.textContent = 'Sending...';
      sendExercise(email, name);
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Sent!';
      setTimeout(function () {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg> Email Me This Exercise';
      }, 3000);
    };
  });
})();
