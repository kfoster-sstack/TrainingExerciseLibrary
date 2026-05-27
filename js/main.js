/* ============================================================
   TrainingExerciseLibrary.com - Main JavaScript
   Part of Schneiders EQ
   ============================================================ */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     Config
     ----------------------------------------------------------- */
  var PER_PAGE = 24;
  var CHUNK_SIZE = 50;
  var DATA_BASE = 'data/';
  var KLAVIYO_COMPANY_ID = window.TEL_KLAVIYO_COMPANY_ID || 'WbH6Ey';
  var KLAVIYO_LIST_ID = window.TEL_KLAVIYO_LIST_ID || 'WyrPPe';

  /* -----------------------------------------------------------
     State
     ----------------------------------------------------------- */
  var allMeta = [];        // lightweight meta array (loaded once)
  var filtered = [];       // current filtered subset of allMeta
  var currentPage = 1;
  var chunkCache = {};     // chunk number -> exercise detail map
  var emailCaptured = localStorage.getItem('tel_email') || '';
  var submissions = JSON.parse(localStorage.getItem('tel_submissions') || '[]');

  /* -----------------------------------------------------------
     DOM Ready
     ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindFilters();
    bindSearch();
    bindMobileMenu();
    bindFAQ();
    bindSubmitForm();
    bindEmailCTA();
    primeFiltersFromURL();
    loadMeta();
  }

  /* -----------------------------------------------------------
     Prime filter selects + search from ?discipline=... etc.
     Enables shareable deep-links into a filtered view from any
     page (e.g. footer links, blog articles, marketing emails).
     ----------------------------------------------------------- */
  function primeFiltersFromURL() {
    if (typeof URLSearchParams === 'undefined') return;
    var params = new URLSearchParams(window.location.search);
    var map = {
      discipline: 'filterDiscipline',
      level: 'filterLevel',
      focus: 'filterFocus',
      time: 'filterTime',
      q: 'searchInput'
    };
    Object.keys(map).forEach(function (key) {
      var val = params.get(key);
      if (!val) return;
      var el = document.getElementById(map[key]);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        for (var i = 0; i < el.options.length; i++) {
          if (el.options[i].value.toLowerCase() === val.toLowerCase()) {
            el.selectedIndex = i;
            break;
          }
        }
      } else {
        el.value = val;
      }
    });
  }

  /* -----------------------------------------------------------
     Async Data Loading
     ----------------------------------------------------------- */
  function loadMeta() {
    var grid = document.getElementById('exercisesGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading exercises...</p></div>';

    fetch(DATA_BASE + 'exercises-meta.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        allMeta = data;
        // applyFilters() respects any URL-primed filter values (set in
        // primeFiltersFromURL during init) so deep-links land on the
        // correct filtered view.
        applyFilters();
      })
      .catch(function () {
        grid.innerHTML = '<div class="no-results"><h3>Unable to load exercises</h3><p>Please refresh the page.</p></div>';
      });
  }

  function getChunkNum(id) {
    return Math.ceil(id / CHUNK_SIZE);
  }

  function loadDetail(exerciseId, callback) {
    var chunkNum = getChunkNum(exerciseId);
    if (chunkCache[chunkNum]) {
      callback(chunkCache[chunkNum][exerciseId]);
      return;
    }
    var fname = 'exercises-chunk-' + String(chunkNum).padStart(2, '0') + '.json';
    fetch(DATA_BASE + fname)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var map = {};
        data.forEach(function (ex) { map[ex.id] = ex; });
        chunkCache[chunkNum] = map;
        callback(map[exerciseId]);
      })
      .catch(function () {
        callback(null);
      });
  }

  /* -----------------------------------------------------------
     Klaviyo Integration
     ----------------------------------------------------------- */
  function subscribeToKlaviyo(email, name, source) {
    if (!KLAVIYO_COMPANY_ID || !KLAVIYO_LIST_ID) return Promise.resolve();

    var profileAttrs = {
      email: email,
      properties: {
        'Lead Source': source || 'training_exercise_library',
        'Signup Date': new Date().toISOString()
      }
    };
    if (name) profileAttrs.first_name = name;

    var payload = {
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
    console.log('[Klaviyo] Subscription payload:', JSON.stringify(payload, null, 2));
    return fetch('https://a.klaviyo.com/client/subscriptions/?company_id=' + KLAVIYO_COMPANY_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'revision': '2024-10-15' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      console.log('[Klaviyo] Subscription response:', response.status, response.statusText);
      if (!response.ok) {
        return response.text().then(function (body) {
          console.error('[Klaviyo] Subscription error body:', body);
        });
      } else {
        console.log('[Klaviyo] Subscription SUCCESS');
      }
      return response;
    }).catch(function (err) {
      console.error('[Klaviyo] Subscription fetch error:', err);
    });
  }

  function buildExerciseEmailHTML(ex) {
    // Brand palette: navy #002848 (headlines), red #c00000 (links/CTAs),
    // cream #f8f3ec (tip callout background). All inline because email
    // clients strip <style>.
    var html = '<h2 style="color:#002848;margin-bottom:8px;">' + ex.title + '</h2>';
    html += '<p style="color:#6B6B6B;margin-bottom:16px;"><strong>Discipline:</strong> ' + ex.discipline + ' &nbsp;|&nbsp; <strong>Level:</strong> ' + ex.level.charAt(0).toUpperCase() + ex.level.slice(1) + ' &nbsp;|&nbsp; <strong>Time:</strong> ' + ex.time + ' min</p>';
    html += '<p style="margin-bottom:4px;"><strong>Focus:</strong> ' + ex.focus.join(', ') + '</p>';
    html += '<p style="color:#6B6B6B;margin-bottom:20px;"><strong>Equipment:</strong> ' + ex.equipment.join(', ') + '</p>';
    html += '<h3 style="color:#002848;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Step-by-Step Instructions</h3><ol style="padding-left:20px;margin-bottom:20px;">';
    ex.steps.forEach(function (s) { html += '<li style="margin-bottom:6px;">' + s + '</li>'; });
    html += '</ol>';
    html += '<h3 style="color:#002848;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Common Mistakes to Avoid</h3><ul style="padding-left:20px;margin-bottom:20px;">';
    ex.mistakes.forEach(function (m) { html += '<li style="margin-bottom:4px;">' + m + '</li>'; });
    html += '</ul>';
    html += '<h3 style="color:#002848;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Variations &amp; Progressions</h3><ul style="padding-left:20px;margin-bottom:20px;">';
    ex.variations.forEach(function (v) { html += '<li style="margin-bottom:4px;">' + v + '</li>'; });
    html += '</ul>';
    html += '<div style="background:#f8f3ec;padding:14px 16px;border-left:4px solid #002848;margin-bottom:20px;"><strong style="color:#002848;">' + ex.tips.split(':')[0] + ':</strong>' + ex.tips.split(':').slice(1).join(':') + '</div>';
    if (ex.equipmentLinks && ex.equipmentLinks.length) {
      html += '<h3 style="color:#002848;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Shop Equipment at sstack.com</h3><p>';
      ex.equipmentLinks.forEach(function (l) {
        html += '<a href="' + l.url + '" style="color:#c00000;margin-right:12px;font-weight:600;">' + l.name + ' &rarr;</a>';
      });
      html += '</p>';
    }
    return html;
  }

  function trackExerciseEvent(email, exerciseData) {
    if (!KLAVIYO_COMPANY_ID) return Promise.resolve();

    var payload = {
      data: {
        type: 'event',
        attributes: {
          properties: {
            exercise_title: exerciseData.title,
            discipline: exerciseData.discipline,
            level: exerciseData.level,
            time: exerciseData.time + ' minutes',
            focus: exerciseData.focus.join(', '),
            equipment: exerciseData.equipment.join(', '),
            steps: exerciseData.steps.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n'),
            mistakes: exerciseData.mistakes.join('\n'),
            variations: exerciseData.variations.join('\n'),
            tips: exerciseData.tips,
            exercise_url: 'https://www.trainingexerciselibrary.com/exercises/' + (exerciseData.slug || ''),
            equipment_links: (exerciseData.equipmentLinks || []).map(function (l) { return l.name + ': ' + l.url; }).join('\n'),
            exercise_html: buildExerciseEmailHTML(exerciseData)
          },
          metric: {
            data: { type: 'metric', attributes: { name: 'Horse Exercise Plan Requested' } }
          },
          profile: {
            data: { type: 'profile', attributes: { email: email } }
          }
        }
      }
    };

    console.log('[Klaviyo] Tracking event:', 'Horse Exercise Plan Requested', 'for:', email);
    console.log('[Klaviyo] Event payload:', JSON.stringify(payload, null, 2));
    return fetch('https://a.klaviyo.com/client/events/?company_id=' + KLAVIYO_COMPANY_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'revision': '2024-10-15' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      console.log('[Klaviyo] Event response:', response.status, response.statusText);
      if (!response.ok) {
        return response.text().then(function (body) {
          console.error('[Klaviyo] Event error body:', body);
        });
      } else {
        console.log('[Klaviyo] Event SUCCESS');
      }
      return response;
    }).catch(function (err) {
      console.error('[Klaviyo] Event fetch error:', err);
    });
  }

  /* -----------------------------------------------------------
     Render Exercise Cards (paginated)
     ----------------------------------------------------------- */
  function renderPage() {
    var grid = document.getElementById('exercisesGrid');
    if (!grid) return;
    var info = document.getElementById('resultsInfo');

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="no-results"><h3>No exercises found</h3><p>Try adjusting your filters or search terms.</p></div>';
      if (info) info.innerHTML = 'Showing <strong>0</strong> exercises';
      renderPagination(0);
      return;
    }

    var totalPages = Math.ceil(filtered.length / PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * PER_PAGE;
    var pageItems = filtered.slice(start, start + PER_PAGE);

    grid.innerHTML = pageItems.map(function (ex) {
      return buildCardHTML(ex);
    }).join('');

    if (info) {
      var showStart = start + 1;
      var showEnd = Math.min(start + PER_PAGE, filtered.length);
      info.innerHTML = 'Showing <strong>' + showStart + '-' + showEnd + '</strong> of ' + filtered.length + ' exercises';
    }

    // Bind card events
    grid.querySelectorAll('.btn-view').forEach(function (btn) {
      btn.addEventListener('click', handleViewToggle);
    });
    renderPagination(totalPages);
  }

  function buildCardHTML(ex) {
    var levelClass = 'badge-level-' + ex.level;
    var levelLabel = ex.level.charAt(0).toUpperCase() + ex.level.slice(1);
    var timeLabel = ex.time + ' min';
    var slugLink = ex.slug ? '<a href="exercises/' + ex.slug + '.html" class="btn-full-page" title="View full exercise page">Full Page &rarr;</a>' : '';

    return '<div class="exercise-card" data-id="' + ex.id + '" data-discipline="' + ex.discipline + '" data-level="' + ex.level + '" data-time="' + ex.time + '" data-focus="' + ex.focus.join(',').toLowerCase() + '">' +
      '<div class="card-header">' +
        '<div class="card-badges">' +
          '<span class="badge badge-discipline">' + ex.discipline + '</span>' +
          '<span class="badge ' + levelClass + '">' + levelLabel + '</span>' +
          '<span class="badge badge-time">' + timeLabel + '</span>' +
        '</div>' +
        '<h3 class="card-title">' + ex.title + '</h3>' +
        '<p class="card-focus"><strong>Focus:</strong> ' + ex.focus.join(', ') + '</p>' +
        '<div class="card-equipment">' +
          '<svg viewBox="0 0 24 24"><path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4z"/></svg>' +
          '<span>' + ex.equipment.join(', ') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn-view" data-id="' + ex.id + '">' +
          '<span>View Exercise</span>' +
          '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>' +
        '</button>' +
        slugLink +
      '</div>' +
      '<div class="card-detail" id="detail-' + ex.id + '">' +
        '<div class="detail-loading"><div class="spinner"></div></div>' +
      '</div>' +
    '</div>';
  }

  function buildDetailHTML(ex) {
    var html = '';

    // Arena Diagram
    if (ex.slug) {
      html += '<div class="detail-section diagram-section" style="margin-bottom:18px;">';
      html += '<h4>Arena Diagram</h4>';
      html += '<div style="max-width:320px;margin:0 auto;">';
      html += '<img src="images/diagrams/' + ex.slug + '.svg" alt="Arena diagram for ' + ex.title + '" style="width:100%;height:auto;" loading="lazy" onerror="this.parentElement.parentElement.style.display=\'none\'">';
      html += '</div></div>';
    }

    // Steps
    html += '<div class="detail-section"><h4>Step-by-Step Instructions</h4><ol class="detail-steps">';
    ex.steps.forEach(function (s) { html += '<li>' + s + '</li>'; });
    html += '</ol></div>';

    // Common Mistakes
    html += '<div class="detail-section detail-mistakes"><h4>Common Mistakes to Avoid</h4><ul>';
    ex.mistakes.forEach(function (m) { html += '<li>' + m + '</li>'; });
    html += '</ul></div>';

    // Variations
    html += '<div class="detail-section detail-variations"><h4>Variations &amp; Progressions</h4><ul>';
    ex.variations.forEach(function (v) { html += '<li>' + v + '</li>'; });
    html += '</ul></div>';

    // Tips
    html += '<div class="detail-section"><div class="detail-tips"><strong>' + ex.tips.split(':')[0] + ':</strong>' + ex.tips.split(':').slice(1).join(':') + '</div></div>';

    // Equipment links
    if (ex.equipmentLinks && ex.equipmentLinks.length > 0) {
      html += '<div class="detail-section"><h4>Shop Equipment at sstack.com</h4><div class="detail-equipment-links">';
      ex.equipmentLinks.forEach(function (link) {
        html += '<a href="' + link.url + '" target="_blank" rel="noopener">' + link.name + ' &rarr;</a>';
      });
      html += '</div></div>';
    }

    // Email + Print buttons (print only visible after email captured)
    html += '<div class="detail-section detail-email-cta">';
    html += '<button class="btn-email-exercise" data-id="' + ex.id + '">';
    html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>';
    html += ' Email Me This Exercise';
    html += '</button>';
    html += '<button class="btn-print-exercise" data-id="' + ex.id + '"' + (emailCaptured ? '' : ' style="display:none"') + '>';
    html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>';
    html += ' Print Exercise';
    html += '</button>';
    html += '</div>';

    return html;
  }

  /* -----------------------------------------------------------
     Pagination
     ----------------------------------------------------------- */
  function renderPagination(totalPages) {
    var container = document.getElementById('paginationControls');
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    var html = '';

    // Prev button
    html += '<button class="page-btn page-prev' + (currentPage === 1 ? ' disabled' : '') + '" data-page="' + (currentPage - 1) + '">&laquo; Prev</button>';

    // Page numbers
    var pages = getPageRange(currentPage, totalPages);
    pages.forEach(function (p) {
      if (p === '...') {
        html += '<span class="page-ellipsis">&hellip;</span>';
      } else {
        html += '<button class="page-btn page-num' + (p === currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
      }
    });

    // Next button
    html += '<button class="page-btn page-next' + (currentPage === totalPages ? ' disabled' : '') + '" data-page="' + (currentPage + 1) + '">Next &raquo;</button>';

    container.innerHTML = html;

    // Bind
    container.querySelectorAll('.page-btn:not(.disabled)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var page = parseInt(this.getAttribute('data-page'), 10);
        if (page >= 1 && page <= totalPages) {
          currentPage = page;
          renderPage();
          document.getElementById('exercisesGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function getPageRange(current, total) {
    if (total <= 7) {
      var arr = [];
      for (var i = 1; i <= total; i++) arr.push(i);
      return arr;
    }
    var pages = [1];
    if (current > 3) pages.push('...');
    for (var j = Math.max(2, current - 1); j <= Math.min(total - 1, current + 1); j++) {
      pages.push(j);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  /* -----------------------------------------------------------
     View Toggle (Lazy detail loading)
     ----------------------------------------------------------- */
  function handleViewToggle(e) {
    var btn = e.currentTarget;
    var id = parseInt(btn.getAttribute('data-id'), 10);
    var detail = document.getElementById('detail-' + id);
    if (!detail) return;

    var isOpen = detail.classList.contains('open');
    if (isOpen) {
      detail.classList.remove('open');
      btn.classList.remove('active');
      btn.querySelector('span').textContent = 'View Exercise';
      return;
    }

    // If detail not loaded yet, fetch it
    if (detail.querySelector('.detail-loading')) {
      loadDetail(id, function (ex) {
        if (ex) {
          detail.innerHTML = buildDetailHTML(ex);
          var emailBtn = detail.querySelector('.btn-email-exercise');
          if (emailBtn) emailBtn.addEventListener('click', handleEmailExercise);
          var printBtn = detail.querySelector('.btn-print-exercise');
          if (printBtn) printBtn.addEventListener('click', handlePrintExercise);
        } else {
          detail.innerHTML = '<p class="detail-error">Unable to load exercise details. Please try again.</p>';
        }
        detail.classList.add('open');
        btn.classList.add('active');
        btn.querySelector('span').textContent = 'Hide Details';
      });
    } else {
      detail.classList.add('open');
      btn.classList.add('active');
      btn.querySelector('span').textContent = 'Hide Details';
    }
  }

  /* -----------------------------------------------------------
     Email Exercise
     ----------------------------------------------------------- */
  function handleEmailExercise(e) {
    var btn = e.currentTarget;
    var id = parseInt(btn.getAttribute('data-id'), 10);

    if (!emailCaptured) {
      openEmailExerciseModal(id);
      return;
    }

    sendExerciseEmail(id, emailCaptured, '', btn);
  }

  function sendExerciseEmail(id, email, name, btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    loadDetail(id, function (ex) {
      if (!ex) {
        showToast('Unable to load exercise. Please try again.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Email Me This Exercise'; }
        return;
      }

      // Subscribe to Klaviyo list
      subscribeToKlaviyo(email, name, 'exercise_email');

      // Track event with full exercise data (triggers Klaviyo flow)
      trackExerciseEvent(email, ex);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Sent!';
        setTimeout(function () {
          btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg> Email Me This Exercise';
        }, 3000);
      }
      showToast('Exercise sent to ' + email + '!', 'success');
    });
  }

  function openEmailExerciseModal(pendingId, pendingAction) {
    var overlay = document.getElementById('emailExerciseModal');
    if (!overlay) return;
    overlay.classList.add('active');
    overlay.setAttribute('data-pending-id', pendingId || '');
    overlay.setAttribute('data-pending-action', pendingAction || 'email');

    overlay.querySelector('.modal-close').onclick = function () { overlay.classList.remove('active'); };
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) overlay.classList.remove('active');
    });

    var form = document.getElementById('emailExerciseForm');
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

      // Reveal all print buttons now that email is captured
      document.querySelectorAll('.btn-print-exercise').forEach(function (b) { b.style.display = ''; });

      // Always subscribe to Klaviyo when email is first captured
      subscribeToKlaviyo(email, name, 'exercise_email');

      overlay.classList.remove('active');

      var pendingId = parseInt(overlay.getAttribute('data-pending-id'), 10);
      var action = overlay.getAttribute('data-pending-action') || 'email';
      if (pendingId) {
        if (action === 'print') {
          // Track the event for the flow trigger, then print
          loadDetail(pendingId, function (ex) {
            if (ex) trackExerciseEvent(email, ex);
            printExercise(pendingId);
          });
        } else {
          var btn = document.querySelector('.btn-email-exercise[data-id="' + pendingId + '"]');
          sendExerciseEmail(pendingId, email, name, btn);
        }
      }
    };
  }

  /* -----------------------------------------------------------
     Print Exercise (email-gated)
     ----------------------------------------------------------- */
  function handlePrintExercise(e) {
    var btn = e.currentTarget;
    var id = parseInt(btn.getAttribute('data-id'), 10);
    printExercise(id);
  }

  function printExercise(id) {
    loadDetail(id, function (ex) {
      if (!ex) {
        showToast('Unable to load exercise. Please try again.', 'error');
        return;
      }

      var slug = ex.slug || '';
      var diagramURL = slug ? (window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/images/diagrams/' + slug + '.svg')) : '';

      var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
      html += '<title>' + ex.title + ' - Training Exercise Library</title>';
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

      html += '<h1>' + ex.title + '</h1>';
      html += '<div class="meta"><strong>Discipline:</strong> ' + ex.discipline + ' &nbsp;|&nbsp; <strong>Level:</strong> ' + ex.level.charAt(0).toUpperCase() + ex.level.slice(1) + ' &nbsp;|&nbsp; <strong>Time:</strong> ' + ex.time + ' min</div>';
      html += '<div class="meta"><strong>Focus:</strong> ' + ex.focus.join(', ') + ' &nbsp;|&nbsp; <strong>Equipment:</strong> ' + ex.equipment.join(', ') + '</div>';

      if (slug) {
        html += '<div class="diagram"><img src="' + diagramURL + '" alt="Arena diagram"></div>';
      }

      html += '<h2>Step-by-Step Instructions</h2><ol>';
      ex.steps.forEach(function (s) { html += '<li>' + s + '</li>'; });
      html += '</ol>';

      html += '<h2>Common Mistakes to Avoid</h2><ul>';
      ex.mistakes.forEach(function (m) { html += '<li>' + m + '</li>'; });
      html += '</ul>';

      html += '<h2>Variations &amp; Progressions</h2><ul>';
      ex.variations.forEach(function (v) { html += '<li>' + v + '</li>'; });
      html += '</ul>';

      html += '<div class="tip"><strong>' + ex.tips.split(':')[0] + ':</strong>' + ex.tips.split(':').slice(1).join(':') + '</div>';

      html += '<div class="footer">Training Exercise Library &mdash; Powered by Schneider Saddlery &mdash; sstack.com</div>';
      html += '</body></html>';

      var printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
        // Wait for diagram image to load before printing
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
    });
  }

  /* -----------------------------------------------------------
     Filters
     ----------------------------------------------------------- */
  function bindFilters() {
    var selects = document.querySelectorAll('.filter-select');
    selects.forEach(function (sel) {
      sel.addEventListener('change', function () {
        currentPage = 1;
        applyFilters();
      });
    });

    var clearBtn = document.querySelector('.filter-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        clearFilters();
        currentPage = 1;
        applyFilters();
      });
    }
  }

  function clearFilters() {
    document.querySelectorAll('.filter-select').forEach(function (sel) { sel.selectedIndex = 0; });
    var search = document.getElementById('searchInput');
    if (search) search.value = '';
  }

  function applyFilters() {
    var discipline = getSelectValue('filterDiscipline');
    var level = getSelectValue('filterLevel');
    var focus = getSelectValue('filterFocus');
    var time = getSelectValue('filterTime');
    var query = (document.getElementById('searchInput') || {}).value || '';
    query = query.toLowerCase().trim();

    filtered = allMeta.filter(function (ex) {
      if (discipline && ex.discipline.toLowerCase().indexOf(discipline.toLowerCase()) === -1) return false;
      if (level && ex.level !== level) return false;
      if (focus && ex.focus.join(',').toLowerCase().indexOf(focus.toLowerCase()) === -1) return false;
      if (time) {
        var t = parseInt(time, 10);
        if (t === 15 && ex.time > 15) return false;
        if (t === 30 && (ex.time < 16 || ex.time > 30)) return false;
        if (t === 45 && (ex.time < 31 || ex.time > 45)) return false;
        if (t === 60 && (ex.time < 46 || ex.time > 60)) return false;
      }
      if (query) {
        var haystack = (ex.title + ' ' + ex.discipline + ' ' + ex.focus.join(' ') + ' ' + ex.equipment.join(' ')).toLowerCase();
        if (haystack.indexOf(query) === -1) return false;
      }
      return true;
    });

    currentPage = 1;
    renderPage();
  }

  function getSelectValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  /* -----------------------------------------------------------
     Search
     ----------------------------------------------------------- */
  function bindSearch() {
    var input = document.getElementById('searchInput');
    if (!input) return;
    var debounce;
    input.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(applyFilters, 250);
    });
  }

  /* -----------------------------------------------------------
     Mobile Menu
     ----------------------------------------------------------- */
  function bindMobileMenu() {
    var btn = document.querySelector('.mobile-menu-btn');
    var nav = document.querySelector('.header-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

  /* -----------------------------------------------------------
     FAQ Accordion
     ----------------------------------------------------------- */
  function bindFAQ() {
    document.querySelectorAll('.faq-question').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var answer = this.nextElementSibling;
        var isOpen = answer.classList.contains('open');
        document.querySelectorAll('.faq-answer').forEach(function (a) { a.classList.remove('open'); });
        document.querySelectorAll('.faq-question').forEach(function (q) { q.classList.remove('active'); });
        if (!isOpen) {
          answer.classList.add('open');
          this.classList.add('active');
        }
      });
    });
  }

  /* -----------------------------------------------------------
     Submit Exercise Form

     Submissions now route to Klaviyo as an "Exercise Submission
     Received" metric event so the editorial team can review them
     inside Klaviyo and so a thank-you / follow-up flow can fire
     automatically. We still write to localStorage for resilience
     and POST to window.TEL_EMAIL_ENDPOINT when one is configured.
     ----------------------------------------------------------- */
  function bindSubmitForm() {
    var form = document.getElementById('submitExerciseForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var data = {
        name: form.querySelector('#subName').value.trim(),
        email: form.querySelector('#subEmail').value.trim(),
        exerciseTitle: form.querySelector('#subTitle').value.trim(),
        discipline: form.querySelector('#subDiscipline').value,
        level: form.querySelector('#subLevel').value,
        description: form.querySelector('#subDescription').value.trim(),
        timestamp: new Date().toISOString()
      };

      submissions.push(data);
      localStorage.setItem('tel_submissions', JSON.stringify(submissions));

      if (data.email) {
        subscribeToKlaviyo(data.email, data.name, 'exercise_submission');
        trackSubmissionEvent(data);
      }

      if (window.TEL_EMAIL_ENDPOINT) {
        fetch(window.TEL_EMAIL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch(function () {});
      }

      form.style.display = 'none';
      document.querySelector('.submit-success').classList.add('show');
      showToast('Exercise submitted! Thank you for contributing.', 'success');
    });
  }

  function trackSubmissionEvent(data) {
    if (!KLAVIYO_COMPANY_ID) return Promise.resolve();
    var payload = {
      data: {
        type: 'event',
        attributes: {
          properties: {
            submitted_title: data.exerciseTitle,
            discipline: data.discipline,
            level: data.level,
            description: data.description,
            submitter_name: data.name,
            submitted_at: data.timestamp
          },
          metric: {
            data: { type: 'metric', attributes: { name: 'Exercise Submission Received' } }
          },
          profile: {
            data: { type: 'profile', attributes: { email: data.email } }
          }
        }
      }
    };
    return fetch('https://a.klaviyo.com/client/events/?company_id=' + KLAVIYO_COMPANY_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'revision': '2024-10-15' },
      body: JSON.stringify(payload)
    }).catch(function (err) {
      console.error('[Klaviyo] Submission event error:', err);
    });
  }

  /* -----------------------------------------------------------
     Email CTA (footer section)
     ----------------------------------------------------------- */
  function bindEmailCTA() {
    var form = document.getElementById('emailCtaForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type="email"]').value.trim();
      if (!email) return;

      emailCaptured = email;
      localStorage.setItem('tel_email', email);

      subscribeToKlaviyo(email, '', 'newsletter_cta');

      form.innerHTML = '<p style="color:var(--white);font-weight:600;">You are subscribed! Check your inbox for new exercises.</p>';
      showToast('Subscribed! Welcome to the Training Exercise Library.', 'success');
    });
  }

  /* -----------------------------------------------------------
     Toast Notifications
     ----------------------------------------------------------- */
  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

})();
