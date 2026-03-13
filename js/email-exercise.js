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

    var subPayload = {
      data: {
        type: 'subscription',
        attributes: {
          custom_source: 'Training Exercise Library',
          profile: { data: { type: 'profile', attributes: profileAttrs } }
        },
        relationships: { list: { data: { type: 'list', id: KLAVIYO_LIST_ID } } }
      }
    };
    console.log('[Klaviyo] Subscribing:', email, 'to list:', KLAVIYO_LIST_ID, 'company:', KLAVIYO_COMPANY_ID);
    console.log('[Klaviyo] Subscription payload:', JSON.stringify(subPayload, null, 2));
    fetch('https://a.klaviyo.com/client/subscriptions/?company_id=' + KLAVIYO_COMPANY_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'revision': '2024-10-15' },
      body: JSON.stringify(subPayload)
    }).then(function (response) {
      console.log('[Klaviyo] Subscription response:', response.status, response.statusText);
      if (!response.ok) {
        return response.text().then(function (body) {
          console.error('[Klaviyo] Subscription error body:', body);
        });
      } else {
        console.log('[Klaviyo] Subscription SUCCESS');
      }
    }).catch(function (err) {
      console.error('[Klaviyo] Subscription fetch error:', err);
    });
  }

  function trackExerciseEvent(email, exerciseData) {
    if (!KLAVIYO_COMPANY_ID) return;

    var evtPayload = {
      data: {
        type: 'event',
        attributes: {
          properties: exerciseData,
          metric: {
            data: { type: 'metric', attributes: { name: 'Horse Exercise Plan Requested' } }
          },
          profile: {
            data: { type: 'profile', attributes: { email: email } }
          }
        }
      }
    };
    console.log('[Klaviyo] Tracking event for:', email);
    console.log('[Klaviyo] Event payload:', JSON.stringify(evtPayload, null, 2));
    fetch('https://a.klaviyo.com/client/events/?company_id=' + KLAVIYO_COMPANY_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'revision': '2024-10-15' },
      body: JSON.stringify(evtPayload)
    }).then(function (response) {
      console.log('[Klaviyo] Event response:', response.status, response.statusText);
      if (!response.ok) {
        return response.text().then(function (body) {
          console.error('[Klaviyo] Event error body:', body);
        });
      } else {
        console.log('[Klaviyo] Event SUCCESS');
      }
    }).catch(function (err) {
      console.error('[Klaviyo] Event fetch error:', err);
    });
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

  function printExercise() {
    var data = getExerciseData();
    if (!data) return;

    var diagramImg = document.querySelector('.diagram-section img');
    var diagramSrc = diagramImg ? diagramImg.src : '';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
    html += '<title>' + data.exercise_title + ' - Training Exercise Library</title>';
    html += '<style>';
    html += 'body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 30px 20px; color: #2A2A2A; line-height: 1.6; }';
    html += 'h1 { color: #1B2A4A; font-size: 22px; margin-bottom: 4px; }';
    html += '.meta { color: #6B6B6B; font-size: 13px; margin-bottom: 16px; }';
    html += '.diagram { text-align: center; margin: 20px 0; }';
    html += '.diagram img { max-width: 320px; height: auto; }';
    html += 'h2 { color: #2D5A3D; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 8px; border-bottom: 2px solid #E8F0EB; padding-bottom: 4px; }';
    html += 'ol, ul { padding-left: 22px; margin-bottom: 16px; }';
    html += 'li { margin-bottom: 6px; font-size: 14px; }';
    html += '.tip { background: #E8F0EB; padding: 12px 14px; border-left: 4px solid #2D5A3D; margin: 16px 0; font-size: 14px; }';
    html += '.footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }';
    html += '@media print { body { padding: 0; } }';
    html += '</style></head><body>';

    html += '<h1>' + data.exercise_title + '</h1>';
    html += '<div class="meta"><strong>Discipline:</strong> ' + data.discipline + ' | <strong>Level:</strong> ' + data.level + ' | <strong>Time:</strong> ' + data.time + '</div>';
    html += '<div class="meta"><strong>Focus:</strong> ' + data.focus + ' | <strong>Equipment:</strong> ' + data.equipment + '</div>';

    if (diagramSrc) {
      html += '<div class="diagram"><img src="' + diagramSrc + '" alt="Arena diagram"></div>';
    }

    html += '<h2>Step-by-Step Instructions</h2><ol>';
    data.steps.split('\n').forEach(function (s) {
      var text = s.replace(/^\d+\.\s*/, '');
      if (text) html += '<li>' + text + '</li>';
    });
    html += '</ol>';

    html += '<h2>Common Mistakes to Avoid</h2><ul>';
    data.mistakes.split('\n').forEach(function (m) { if (m.trim()) html += '<li>' + m + '</li>'; });
    html += '</ul>';

    html += '<h2>Variations & Progressions</h2><ul>';
    data.variations.split('\n').forEach(function (v) { if (v.trim()) html += '<li>' + v + '</li>'; });
    html += '</ul>';

    html += '<div class="tip"><strong>' + data.tips.split(':')[0] + ':</strong>' + data.tips.split(':').slice(1).join(':') + '</div>';
    html += '<div class="footer">Training Exercise Library &mdash; Powered by Schneider Saddlery &mdash; sstack.com</div>';
    html += '</body></html>';

    var printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      var img = printWin.document.querySelector('.diagram img');
      if (img && !img.complete) {
        img.onload = function () { printWin.print(); };
        img.onerror = function () { printWin.print(); };
      } else {
        setTimeout(function () { printWin.print(); }, 300);
      }
      showToast('Print dialog opened!', 'success');
    } else {
      showToast('Please allow pop-ups to print exercises.', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('btnEmailExercise');
    var printBtnEl = document.getElementById('btnPrintExercise');
    var modal = document.getElementById('emailExerciseModal');
    var form = document.getElementById('emailExerciseForm');
    if (!btn || !modal || !form) return;

    var pendingAction = 'email'; // 'email' or 'print'

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
      pendingAction = 'email';
      modal.classList.add('active');
    });

    if (printBtnEl) {
      if (!emailCaptured) printBtnEl.style.display = 'none';
      printBtnEl.addEventListener('click', function () {
        printExercise();
      });
    }

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

      // Reveal print button now that email is captured
      if (printBtnEl) printBtnEl.style.display = '';

      modal.classList.remove('active');

      if (pendingAction === 'print') {
        printExercise();
      } else {
        btn.disabled = true;
        btn.textContent = 'Sending...';
        sendExercise(email, name);
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Sent!';
        setTimeout(function () {
          btn.disabled = false;
          btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg> Email Me This Exercise';
        }, 3000);
      }
    };
  });
})();
