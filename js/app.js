(() => {
  // ── State ──────────────────────────────────────────────
  let _fields          = {};
  let _fieldDefs       = [];
  let _currentIdx      = 0;
  let _templateBuffer  = null;
  let _templateName    = '';
  let _templateId      = null;
  let _autoAdvance     = false;
  let _lockedFields    = {}; // { fieldKey: value }
  let _aiCorrectedText = null; // { corrected, original } când corecția AI așteaptă confirmare

  const $ = (id) => document.getElementById(id);

  // ── Date conversion (spoken Romanian → DD.MM.YYYY) ──────────
  const DATE_FIELDS = new Set(['data_nasterii', 'perioada', 'data']);

  const _ZILE = (() => {
    const m = {
      'întâi': 1, 'intai': 1, 'unu': 1, 'una': 1,
      'doi': 2, 'două': 2, 'doua': 2,
      'trei': 3, 'patru': 4, 'cinci': 5,
      'șase': 6, 'sase': 6,
      'șapte': 7, 'sapte': 7,
      'opt': 8,
      'nouă': 9, 'noua': 9,
      'zece': 10,
      'unsprezece': 11,
      'doisprezece': 12, 'douăsprezece': 12, 'douasprezece': 12,
      'treisprezece': 13,
      'paisprezece': 14,
      'cincisprezece': 15,
      'șaisprezece': 16, 'saisprezece': 16,
      'șaptesprezece': 17, 'saptesprezece': 17,
      'optsprezece': 18,
      'nouăsprezece': 19, 'nouasprezece': 19,
      'douăzeci': 20, 'douazeci': 20,
    };
    // douăzeci și unu … treizeci și unu
    const zeci = [['douăzeci', 'douazeci', 20], ['treizeci', 'treizeci', 30]];
    const unitati = [
      ['unu', 'una', 1], ['doi', 'două', 2], ['doua', 'doua', 2],
      ['trei', 'trei', 3], ['patru', 'patru', 4], ['cinci', 'cinci', 5],
      ['șase', 'sase', 6], ['șapte', 'sapte', 7], ['opt', 'opt', 8], ['nouă', 'noua', 9],
    ];
    for (const [z1, z2, zv] of zeci) {
      for (const [u1, u2, uv] of unitati) {
        const v = zv + uv;
        if (v > 31) continue;
        m[`${z1} și ${u1}`] = v;
        m[`${z1} si ${u1}`] = v;
        m[`${z2} și ${u2}`] = v;
        m[`${z2} si ${u2}`] = v;
      }
    }
    m['treizeci'] = 30;
    return m;
  })();

  const _LUNI = {
    'ianuarie': '01', 'ian': '01',
    'februarie': '02', 'feb': '02',
    'martie': '03', 'mar': '03',
    'aprilie': '04', 'apr': '04',
    'mai': '05',
    'iunie': '06', 'iun': '06',
    'iulie': '07', 'iul': '07',
    'august': '08', 'aug': '08',
    'septembrie': '09', 'sep': '09', 'sept': '09',
    'octombrie': '10', 'oct': '10',
    'noiembrie': '11', 'noi': '11', 'nov': '11',
    'decembrie': '12', 'dec': '12',
  };

  function _convertSpokenDate(text) {
    const dayKeys = Object.keys(_ZILE).sort((a, b) => b.length - a.length);
    const monthKeys = Object.keys(_LUNI).sort((a, b) => b.length - a.length);
    const dayPat   = dayKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const monthPat = monthKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp(`(${dayPat})\\s+(${monthPat})\\s+(\\d{4})`, 'gi');
    return text.replace(re, (_, d, mo, yr) => {
      const day = _ZILE[d.toLowerCase()];
      const mon = _LUNI[mo.toLowerCase()];
      if (!day || !mon) return _;
      return `${String(day).padStart(2, '0')}.${mon}.${yr}`;
    });
  }

  const screens = {
    upload:    $('screen-upload'),
    dictation: $('screen-dictation'),
    generate:  $('screen-generate'),
    history:   $('screen-history'),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  // ── Theme (light/dark) ──────────────────────────────────
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
    const isDark = theme === 'dark' ||
      (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const sun  = document.querySelector('.icon-sun');
    const moon = document.querySelector('.icon-moon');
    if (sun && moon) {
      sun.classList.toggle('hidden', isDark);
      moon.classList.toggle('hidden', !isDark);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0a0f1e' : '#4f46e5');
  }

  function initTheme() {
    applyTheme(localStorage.getItem('medvoice-theme') || 'auto');
    const btn = $('btn-theme-toggle');
    if (btn) btn.addEventListener('click', () => {
      const cur  = localStorage.getItem('medvoice-theme') || 'auto';
      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const curDark = cur === 'dark' || (cur === 'auto' && sysDark);
      const next = curDark ? 'light' : 'dark';
      localStorage.setItem('medvoice-theme', next);
      applyTheme(next);
    });
  }

  // ── Salut după ora zilei ────────────────────────────────
  function updateGreeting() {
    const h  = new Date().getHours();
    const gt = $('greeting-text');
    const gd = $('greeting-date');
    if (gt) gt.textContent = h < 5 ? 'Noapte bună' : h < 12 ? 'Bună dimineața' : h < 18 ? 'Bună ziua' : 'Bună seara';
    if (gd) gd.textContent = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function toast(msg, type = 'info', ms = 2800) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('toast-container').appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function haptic(pattern) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  const SVG_DOC = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  const SVG_SESSION = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
    <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const SVG_DEL = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;

  const SVG_STAR_EMPTY = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;

  const SVG_STAR_FILLED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>`;

  const SVG_LOCK_OPEN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  const SVG_LOCK_CLOSED = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  // ── Mic helper ─────────────────────────────────────────
  function setMicState(state) {
    const btn     = $('btn-mic');
    const icon    = btn.querySelector('.mic-icon');
    const spinner = btn.querySelector('.mic-spinner');
    const label   = $('mic-label');

    btn.classList.remove('recording', 'transcribing');
    icon.classList.remove('hidden');
    spinner.classList.add('hidden');

    if (state === 'idle') {
      label.textContent = 'Dictează';
      btn.classList.remove('hidden');
      // continue button shown separately by caller when needed
    } else if (state === 'recording') {
      btn.classList.add('recording');
      btn.classList.remove('hidden');
      $('btn-continue').classList.add('hidden');
      label.textContent = 'Stop';
    } else if (state === 'transcribing') {
      btn.classList.add('transcribing');
      icon.classList.add('hidden');
      spinner.classList.remove('hidden');
      label.textContent = 'Procesez...';
    } else if (state === 'loading') {
      label.textContent = 'Se încarcă';
    }
  }

  function showContinueBtn() {
    $('btn-mic').classList.add('hidden');
    $('btn-continue').classList.remove('hidden');
  }

  function hideContinueBtn() {
    $('btn-continue').classList.add('hidden');
    $('btn-mic').classList.remove('hidden');
  }

  // ── History screen ──────────────────────────────────────
  $('btn-open-history').addEventListener('click', () => {
    showScreen('history');
    initHistoryScreen();
  });

  $('btn-back-history').addEventListener('click', () => showScreen('upload'));

  async function initHistoryScreen() {
    const sessions = await Storage.getSessions(9999).catch(() => []);
    const listEl   = $('history-list');
    const searchEl = $('history-search');
    searchEl.value = '';

    if (sessions.length === 0) {
      listEl.innerHTML = '<div class="history-empty">Nu există documente în istoric.</div>';
      searchEl.oninput = null;
      return;
    }

    const todayKey     = new Date().toISOString().slice(0, 10);
    const yesterdayKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Grupare pe zile
    const groups = {};
    sessions.forEach((ses) => {
      const key = new Date(ses.savedAt).toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(ses);
    });

    function dayLabel(key) {
      if (key === todayKey)     return 'Astăzi';
      if (key === yesterdayKey) return 'Ieri';
      const d = new Date(key + 'T12:00:00');
      return d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function buildDocName(ses) {
      const patient = (ses.values.pacient || ses.values.patient || '').trim();
      const slug    = patient.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '') || ses.templateName;
      const date    = new Date(ses.savedAt).toISOString().slice(0, 10);
      return `${slug}_${date}.docx`;
    }

    function highlightText(raw, filter) {
      if (!filter) return escHtml(raw);
      const safe = escHtml(raw);
      const re   = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return safe.replace(re, '<mark class="search-hl">$1</mark>');
    }

    function renderGroups(filterText) {
      listEl.innerHTML = '';
      const filter = (filterText || '').toLowerCase().trim();
      const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));
      let totalVisible = 0;

      sortedDays.forEach((dayKey, idx) => {
        const docs = groups[dayKey];
        const visible = filter
          ? docs.filter((ses) => {
              const name    = buildDocName(ses).toLowerCase();
              const patient = (ses.values.pacient || ses.values.patient || '').toLowerCase();
              const tpl     = ses.templateName.toLowerCase();
              return name.includes(filter) || patient.includes(filter) || tpl.includes(filter);
            })
          : docs;

        if (!visible.length) return;
        totalVisible += visible.length;

        const collapsed = idx >= 2 && !filter;
        const group = document.createElement('div');
        group.className = 'history-day-group' + (collapsed ? ' collapsed' : '');
        group.innerHTML = `
          <div class="history-day-header">
            <span class="history-day-label">${escHtml(dayLabel(dayKey))}</span>
            <span class="history-day-badge">${visible.length}</span>
            <svg class="history-day-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="history-day-docs"></div>`;

        group.querySelector('.history-day-header').addEventListener('click', () => {
          group.classList.toggle('collapsed');
        });

        const docsEl = group.querySelector('.history-day-docs');
        visible.forEach((ses) => {
          const docName = buildDocName(ses);
          const timeStr = new Date(ses.savedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
          const item    = document.createElement('div');
          item.className = 'history-doc-item';
          item.innerHTML = `
            <div class="history-doc-icon">${SVG_DOC}</div>
            <div class="history-doc-info">
              <div class="history-doc-name">${highlightText(docName, filter)}</div>
              <div class="history-doc-meta">${escHtml(ses.templateName)} · ${timeStr}</div>
            </div>
            <button class="history-doc-del" data-id="${ses.id}" aria-label="Șterge">${SVG_DEL}</button>`;

          item.addEventListener('click', async (e) => {
            if (e.target.classList.contains('history-doc-del')) return;
            const tpls = await Storage.getTemplates().catch(() => []);
            const tpl  = tpls.find((t) => t.id === ses.templateId);
            if (!tpl) { toast('Template șters — nu se poate redeschide.', 'error', 3000); return; }
            _templateBuffer = tpl.rawBytes;
            _templateName   = tpl.name;
            _fieldDefs      = tpl.fields;
            _templateId     = tpl.id;
            _fields         = {};
            tpl.fields.forEach(({ key }) => (_fields[key] = ses.values[key] || ''));
            renderPreview();
            showScreen('generate');
          });

          item.querySelector('.history-doc-del').addEventListener('click', async (e) => {
            e.stopPropagation();
            await Storage.deleteSession(ses.id);
            groups[dayKey] = groups[dayKey].filter((s) => s.id !== ses.id);
            if (!groups[dayKey].length) delete groups[dayKey];
            renderGroups(searchEl.value);
          });

          docsEl.appendChild(item);
        });

        listEl.appendChild(group);
      });

      if (!totalVisible) {
        listEl.innerHTML = `<div class="history-empty">Niciun document găsit pentru „${escHtml(filterText)}".</div>`;
      }
    }

    renderGroups('');

    let searchTimer;
    searchEl.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderGroups(searchEl.value), 180);
    };
  }

  // ── Upload screen ───────────────────────────────────────
  async function initUploadScreen() {
    const [templates, sessions] = await Promise.all([
      Storage.getTemplates().catch(() => []),
      Storage.getSessions(10).catch(() => []),
    ]);

    // Citim draft-urile pentru toate template-urile în paralel
    const drafts = await Promise.all(
      templates.map((tpl) => Storage.getDraft(tpl.id).catch(() => null))
    );

    updateGreeting();

    // ── Statistici rapide ──
    const todayKey  = new Date().toISOString().slice(0, 10);
    const todayDocs = sessions.filter((s) => new Date(s.savedAt).toISOString().slice(0, 10) === todayKey).length;
    const draftsInProgress = drafts.filter((d, i) => {
      if (!d) return false;
      const filled = Object.values(d.fields).filter(Boolean).length;
      return filled > 0 && filled < templates[i].fields.length;
    }).length;
    if ($('stat-today'))     $('stat-today').textContent     = todayDocs;
    if ($('stat-templates')) $('stat-templates').textContent = templates.length;
    if ($('stat-drafts'))    $('stat-drafts').textContent    = draftsInProgress;

    // ── Card „continuă unde ai rămas" — cel mai recent draft incomplet ──
    const continueCard = $('continue-card');
    if (continueCard) {
      let best = null;
      drafts.forEach((d, i) => {
        if (!d) return;
        const tpl    = templates[i];
        const filled = Object.values(d.fields).filter(Boolean).length;
        const total  = tpl.fields.length;
        if (filled > 0 && filled < total && (!best || d.updatedAt > best.updatedAt)) {
          best = { tpl, filled, total, updatedAt: d.updatedAt || 0 };
        }
      });
      if (best) {
        continueCard.classList.remove('hidden');
        $('continue-title').textContent   = best.tpl.name;
        $('continue-meta').textContent    = `${best.filled}/${best.total}`;
        $('continue-bar-fill').style.width = Math.round((best.filled / best.total) * 100) + '%';
        continueCard.onclick = () => startDictation(best.tpl.rawBytes, best.tpl.name, best.tpl.fields, best.tpl.id);
      } else {
        continueCard.classList.add('hidden');
        continueCard.onclick = null;
      }
    }

    // ── Template-uri salvate ──
    const tplSection = $('saved-templates-section');
    const tplList    = $('saved-templates-list');
    if (templates.length === 0) {
      tplSection.classList.add('hidden');
    } else {
      tplSection.classList.remove('hidden');
      tplList.innerHTML = '';
      templates.forEach((tpl, i) => {
        const draft  = drafts[i];
        const filled = draft ? Object.values(draft.fields).filter(Boolean).length : 0;
        const total  = tpl.fields.length;
        const hasDraft = draft && filled > 0;
        let badgeHtml = '';
        if (hasDraft) {
          if (filled === total) {
            badgeHtml = `<span class="draft-badge complete">✓ Complet</span>`;
          } else {
            badgeHtml = `<span class="draft-badge incomplete">● ${filled}/${total}</span>`;
          }
        }
        const isPinned = !!tpl.pinned;
        const item = document.createElement('div');
        item.className = 'template-item' + (isPinned ? ' pinned-item' : '');
        item.innerHTML = `
          <div class="template-item-icon">${SVG_DOC}</div>
          <div class="template-item-info">
            <div class="template-item-name">${escHtml(tpl.name)}</div>
            <div class="template-item-meta">${tpl.fields.length} câmpuri · ${new Date(tpl.savedAt).toLocaleDateString('ro-RO')}</div>
          </div>
          ${badgeHtml}
          <button class="template-pin-btn${isPinned ? ' pinned' : ''}" data-id="${tpl.id}" aria-label="${isPinned ? 'Dezancorează' : 'Ancorează'}" title="${isPinned ? 'Dezancorează' : 'Ancorează'}">
            ${isPinned ? SVG_STAR_FILLED : SVG_STAR_EMPTY}
          </button>
          <button class="template-item-del" data-id="${tpl.id}" aria-label="Șterge">${SVG_DEL}</button>`;
        item.addEventListener('click', (e) => {
          if (e.target.closest('.template-item-del') || e.target.closest('.template-pin-btn')) return;
          startDictation(tpl.rawBytes, tpl.name, tpl.fields, tpl.id);
        });
        item.querySelector('.template-pin-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          const newPinned = !tpl.pinned;
          await Storage.pinTemplate(tpl.id, newPinned);
          toast(newPinned ? '⭐ Template fixat' : 'Template defixat', 'info', 1600);
          initUploadScreen();
        });
        item.querySelector('.template-item-del').addEventListener('click', async (e) => {
          e.stopPropagation();
          await Storage.deleteTemplate(tpl.id);
          await Storage.clearDraft(tpl.id);
          initUploadScreen();
        });
        tplList.appendChild(item);
      });
    }

    // ── Sesiuni recente ──
    const sesSection = $('recent-sessions-section');
    const sesList    = $('recent-sessions-list');
    if (sessions.length === 0) {
      sesSection.classList.add('hidden');
    } else {
      sesSection.classList.remove('hidden');
      sesList.innerHTML = '';
      sessions.forEach((ses) => {
        const patient  = (ses.values.pacient || ses.values.patient || '').trim() || 'Pacient';
        const dateStr  = new Date(ses.savedAt).toLocaleDateString('ro-RO');
        const timeStr  = new Date(ses.savedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
        const item     = document.createElement('div');
        item.className = 'template-item';
        item.innerHTML = `
          <div class="template-item-icon">${SVG_SESSION}</div>
          <div class="template-item-info">
            <div class="template-item-name">${escHtml(patient)}</div>
            <div class="template-item-meta">${escHtml(ses.templateName)} · ${dateStr} ${timeStr}</div>
          </div>
          <button class="template-item-del" data-id="${ses.id}" aria-label="Șterge">${SVG_DEL}</button>`;

        item.addEventListener('click', async (e) => {
          if (e.target.classList.contains('template-item-del')) return;
          // Reîncarcă template-ul asociat și deschide ecranul de generare
          const tpls = await Storage.getTemplates().catch(() => []);
          const tpl  = tpls.find((t) => t.id === ses.templateId);
          if (!tpl) { toast('Template șters — nu se poate redeschide.', 'error', 3000); return; }
          _templateBuffer = tpl.rawBytes;
          _templateName   = tpl.name;
          _fieldDefs      = tpl.fields;
          _templateId     = tpl.id;
          _fields         = {};
          tpl.fields.forEach(({ key }) => (_fields[key] = ses.values[key] || ''));
          renderPreview();
          showScreen('generate');
        });

        item.querySelector('.template-item-del').addEventListener('click', async (e) => {
          e.stopPropagation();
          await Storage.deleteSession(ses.id);
          initUploadScreen();
        });
        sesList.appendChild(item);
      });
    }
  }

  // ── Acțiuni rapide home ──
  $('action-new').addEventListener('click', () => $('file-input').click());
  $('action-history').addEventListener('click', () => { showScreen('history'); initHistoryScreen(); });
  $('stat-card-today').addEventListener('click', () => { showScreen('history'); initHistoryScreen(); });
  $('stat-card-templates').addEventListener('click', () => {
    document.getElementById('saved-templates-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('stat-card-drafts').addEventListener('click', () => {
    $('continue-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Drop-zone pe body — drag .docx oriunde pe home
  document.body.addEventListener('dragover', (e) => {
    if (screens.upload.classList.contains('active')) e.preventDefault();
  });
  document.body.addEventListener('drop', async (e) => {
    if (!screens.upload.classList.contains('active')) return;
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await handleUpload(file);
  });
  $('file-input').addEventListener('change', async (e) => {
    if (e.target.files[0]) await handleUpload(e.target.files[0]);
    e.target.value = '';
  });

  async function handleUpload(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'docx' && ext !== 'doc') {
      toast('Selectează un fișier .docx sau .doc', 'error'); return;
    }
    if (ext === 'doc') {
      toast('Deschide fișierul în Word și salvează ca .docx (File → Save As → Word Document .docx).', 'error', 7000);
      return;
    }
    try {
      const tpl = await Template.loadFromFile(file);
      const id  = await Storage.saveTemplate(tpl.name, tpl.fileName, tpl.fields, tpl.rawBytes);
      toast(`${tpl.fields.length} câmpuri detectate`, 'success');
      startDictation(tpl.rawBytes, tpl.name, tpl.fields, id);
    } catch (err) {
      toast(err.message, 'error', 7000);
    }
  }

  // ── Dictation screen ─────────────────────────────────────
  async function startDictation(buffer, name, fieldDefs, templateId) {
    _templateBuffer = buffer;
    _templateName   = name;
    _fieldDefs      = fieldDefs;
    _templateId     = templateId;
    _fields         = {};
    _currentIdx     = 0;
    fieldDefs.forEach(({ key }) => (_fields[key] = ''));

    // Câmpuri locked — pre-completate automat
    _lockedFields = await Storage.getLockedFields(templateId).catch(() => ({}));
    Object.entries(_lockedFields).forEach(([key, val]) => {
      if (key in _fields) _fields[key] = val;
    });

    // Reia draft-ul salvat dacă există
    const draft = await Storage.getDraft(templateId);
    if (draft && Object.values(draft.fields).some(Boolean)) {
      Object.keys(draft.fields).forEach((k) => {
        if (k in _fields && !(k in _lockedFields)) _fields[k] = draft.fields[k] || '';
      });
      toast('Sesiune anterioară reluată', 'info', 2500);
    } else if (Object.keys(_lockedFields).length > 0) {
      toast(`${Object.keys(_lockedFields).length} câmp${Object.keys(_lockedFields).length === 1 ? '' : 'uri'} pre-completate`, 'info', 2000);
    }

    $('template-name-display').textContent = name;
    renderFields();
    updateProgress();

    // Sari la primul câmp gol
    const firstEmpty = _fieldDefs.findIndex(({ key }) => !_fields[key]);
    await setActiveField(firstEmpty >= 0 ? firstEmpty : 0);
    renderSuggestions([]);
    showScreen('dictation');
  }

  function renderSegments() {
    const c = $('field-segments');
    c.innerHTML = '';
    _fieldDefs.forEach(({ key, label }, idx) => {
      const seg = document.createElement('div');
      const filled = !!_fields[key];
      const active = idx === _currentIdx;
      seg.className = 'field-seg' + (active ? ' seg-active' : filled ? ' seg-filled' : '');
      seg.title = label;
      seg.addEventListener('click', () => {
        if (Voice.isRecording()) Voice.stop();
        setActiveField(idx);
        $('transcript-edit').focus();
      });
      c.appendChild(seg);
    });
  }

  function renderFields() {
    const c = $('fields-container');
    c.innerHTML = '';
    _fieldDefs.forEach(({ key, label }, idx) => {
      const isLocked = key in _lockedFields;
      const el = document.createElement('div');
      el.className = 'field-item' + (isLocked ? ' locked-field' : '');
      el.dataset.key = key;
      el.innerHTML = `
        <div class="field-item-header">
          <span class="field-item-name">${escHtml(label)}</span>
          <button class="field-lock-btn${isLocked ? ' locked' : ''}" data-key="${escHtml(key)}" title="${isLocked ? 'Deblocați câmpul' : 'Blocați valoarea'}">
            ${isLocked ? SVG_LOCK_CLOSED : SVG_LOCK_OPEN}
          </button>
          <span class="field-status empty">gol</span>
        </div>
        <div class="field-item-value empty-value">—</div>`;
      el.addEventListener('click', (e) => {
        if (e.target.closest('.field-lock-btn')) return;
        if (Voice.isRecording()) Voice.stop();
        setActiveField(idx);
        $('transcript-edit').focus();
      });
      el.querySelector('.field-lock-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleLockField(key);
      });
      c.appendChild(el);
    });
    renderSegments();
  }

  async function toggleLockField(key) {
    if (key in _lockedFields) {
      delete _lockedFields[key];
      toast('Câmp deblocat', 'info', 1600);
    } else {
      const currentValue = _fields[key] || '';
      _lockedFields[key] = currentValue;
      toast(currentValue ? `Blocat: "${currentValue}"` : 'Câmp blocat (fără valoare)', 'info', 2000);
    }
    await Storage.setLockedFields(_templateId, _lockedFields).catch(() => {});
    // Re-render just the lock button and class for this field
    const el = document.querySelector(`.field-item[data-key="${key}"]`);
    if (el) {
      const isLocked = key in _lockedFields;
      const btn = el.querySelector('.field-lock-btn');
      btn.innerHTML = isLocked ? SVG_LOCK_CLOSED : SVG_LOCK_OPEN;
      btn.classList.toggle('locked', isLocked);
      btn.title = isLocked ? 'Deblocați câmpul' : 'Blocați valoarea';
      el.classList.toggle('locked-field', isLocked);
    }
  }

  async function setActiveField(idx) {
    _currentIdx = Math.min(idx, _fieldDefs.length - 1);

    // Resetăm starea AI la fiecare navigare între câmpuri
    _aiCorrectedText = null;
    hideAiRevert();
    setConfirmProcessing(false);

    const { key, label } = _fieldDefs[_currentIdx];

    $('current-field-name').textContent = label;
    $('transcript-edit').value = _fields[key] || '';
    $('transcript-edit').disabled = false;
    Voice.resetText();
    hideContinueBtn();

    if (_fields[key]) showConfirm(); else hideConfirm();

    document.querySelectorAll('.field-item').forEach((el, i) => {
      const k      = _fieldDefs[i].key;
      const status = el.querySelector('.field-status');
      const val    = el.querySelector('.field-item-value');
      el.classList.remove('active', 'filled');

      if (i === _currentIdx) {
        el.classList.add('active');
        status.className   = 'field-status active';
        status.textContent = 'activ';
      } else if (_fields[k]) {
        el.classList.add('filled');
        status.className   = 'field-status filled';
        status.textContent = 'completat';
      } else {
        status.className   = 'field-status empty';
        status.textContent = 'gol';
      }

      val.textContent = _fields[k] || '—';
      val.classList.toggle('empty-value', !_fields[k]);
    });

    // Sugestii valori frecvente pentru câmpul activ
    const suggestions = await Storage.getSuggestions(key, 5);
    renderSuggestions(suggestions);
    renderSegments();
  }

  function renderSuggestions(suggestions) {
    const container = $('suggestions-container');
    if (!suggestions.length) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = suggestions
      .map((s) => `<button class="suggestion-chip" data-value="${escHtml(s)}">${escHtml(s)}</button>`)
      .join('');
    container.querySelectorAll('.suggestion-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('transcript-edit').value = btn.dataset.value;
        showConfirm();
        $('transcript-edit').focus();
      });
    });
  }

  function saveCurrentField(text) {
    const { key } = _fieldDefs[_currentIdx];
    _fields[key] = text;

    const el = document.querySelector(`.field-item[data-key="${key}"]`);
    if (el) {
      el.classList.add('filled');
      el.querySelector('.field-status').className   = 'field-status filled';
      el.querySelector('.field-status').textContent = 'completat';
      el.querySelector('.field-item-value').textContent = text;
      el.querySelector('.field-item-value').classList.remove('empty-value');
    }
    updateProgress();
    renderSegments();
  }

  function updateProgress() {
    const filled = Object.values(_fields).filter(Boolean).length;
    const total  = _fieldDefs.length;
    $('fields-filled-count').textContent = filled;
    $('fields-total-count').textContent  = total;
    $('btn-generate').disabled = false;
    const pct = total > 0 ? (filled / total) * 100 : 0;
    const bar = $('progress-bar-fill');
    bar.style.width = pct + '%';
    bar.classList.toggle('complete', filled === total && total > 0);
  }

  // ── Confirm button ────────────────────────────────────────
  function showConfirm() { $('btn-confirm-field').classList.remove('hidden'); }
  function hideConfirm() { $('btn-confirm-field').classList.add('hidden'); }

  // ── AI helpers ────────────────────────────────────────────
  const _BTN_CONFIRM_DEFAULT_HTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Gata — salvează câmpul`;

  function setConfirmProcessing(on) {
    const btn = $('btn-confirm-field');
    if (!btn) return;
    if (on) {
      btn.disabled = true;
      btn.classList.add('ai-processing');
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="40 20">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite"/>
        </circle>
      </svg> AI corectează...`;
    } else {
      btn.disabled = false;
      btn.classList.remove('ai-processing');
      btn.innerHTML = _BTN_CONFIRM_DEFAULT_HTML;
    }
  }

  function showAiRevert() {
    const row = $('ai-revert-row');
    if (row) row.classList.remove('hidden');
  }

  function hideAiRevert() {
    const row = $('ai-revert-row');
    if (row) row.classList.add('hidden');
  }

  $('transcript-edit').addEventListener('input', () => {
    if ($('transcript-edit').value.trim()) showConfirm(); else hideConfirm();
  });

  $('btn-auto-advance').addEventListener('click', () => {
    _autoAdvance = !_autoAdvance;
    const btn = $('btn-auto-advance');
    btn.classList.toggle('on', _autoAdvance);
    btn.setAttribute('aria-checked', String(_autoAdvance));
    toast(_autoAdvance ? '⚡ Auto-avans activat' : 'Auto-avans dezactivat', 'info', 1600);
  });

  $('btn-confirm-field').addEventListener('click', () => {
    if (_aiCorrectedText !== null) {
      doSaveField(_autoAdvance);
    } else {
      confirmField(_autoAdvance);
    }
  });

  async function confirmField(autoStartVoice = false) {
    const originalText = $('transcript-edit').value.trim();
    if (!originalText) { toast('Câmpul este gol.', 'error', 1800); return; }

    if (Voice.isRecording()) Voice.stop();

    const capturedIdx        = _currentIdx;
    const { key, label }     = _fieldDefs[capturedIdx];

    if (AI.isEnabled()) {
      setConfirmProcessing(true);
      try {
        const corrected = await AI.processField(key, label, originalText);
        if (_currentIdx !== capturedIdx) return; // utilizatorul a navigat între timp

        const fixed = (corrected || '').trim();
        if (fixed && fixed !== originalText) {
          // Textul a fost corectat — afișăm și așteptăm confirmarea
          _aiCorrectedText = { corrected: fixed, original: originalText };
          $('transcript-edit').value = fixed;
          setConfirmProcessing(false);
          showAiRevert();
          if (autoStartVoice) {
            // Auto-avans: confirmăm automat după 1.4s
            setTimeout(() => {
              if (_currentIdx === capturedIdx && _aiCorrectedText !== null) doSaveField(autoStartVoice);
            }, 1400);
          }
          return;
        }
      } catch (_) {
        // Fallback silențios — salvăm textul original
      }
      if (_currentIdx !== capturedIdx) return;
      setConfirmProcessing(false);
    }

    doSaveField(autoStartVoice);
  }

  async function doSaveField(autoStartVoice = false) {
    const text = $('transcript-edit').value.trim();
    if (!text) { toast('Câmpul este gol.', 'error', 1800); return; }

    const { key, label } = _fieldDefs[_currentIdx];
    _aiCorrectedText = null;
    hideAiRevert();

    saveCurrentField(text);
    haptic(20);
    toast(`✓ ${label} salvat`, 'success', 1500);
    hideConfirm();
    renderSuggestions([]);

    Storage.saveDraft(_templateId, { ..._fields }).catch(() => {});
    Storage.addSuggestion(key, text).catch(() => {});

    const next = _currentIdx + 1;
    if (next < _fieldDefs.length) {
      await setActiveField(next);
      if (autoStartVoice && Voice.isReady() && !Voice.isRecording()) {
        setTimeout(() => Voice.start(), 400);
      }
    } else {
      $('current-field-name').textContent = '✓ Toate câmpurile completate';
      $('transcript-edit').value = '';
      $('transcript-edit').disabled = true;
      toast('Toate câmpurile completate!', 'success', 3000);
    }
  }

  // ── Voice callbacks ───────────────────────────────────────
  Voice.init({
    onModelLoading() {},
    onModelReady() {},
    onStart() {
      haptic(10);
      setMicState('recording');
      $('recording-badge').classList.remove('hidden');
      $('transcript-edit').classList.add('recording');
      const { key } = _fieldDefs[_currentIdx] || {};
      if (key && !_fields[key] && !$('transcript-edit').value) $('transcript-edit').value = '';
      hideConfirm();
    },
    onStop() {
      haptic([5, 40, 5]);
      $('recording-badge').classList.add('hidden');
      $('transcript-edit').classList.remove('recording');
      setMicState('idle');
      if ($('transcript-edit').value.trim()) showContinueBtn();
    },
    onTranscribing() {},
    onInterim(text) {
      const { key } = _fieldDefs[_currentIdx] || {};
      const out = DATE_FIELDS.has(key) ? _convertSpokenDate(text) : text;
      $('transcript-edit').value = out;
      if (out) showConfirm(); else hideConfirm();
    },
    onTranscript(text) {
      setMicState('idle');
      const { key } = _fieldDefs[_currentIdx] || {};
      const out = DATE_FIELDS.has(key) ? _convertSpokenDate(text) : text;
      $('transcript-edit').value = out;
      if (out.trim()) showConfirm(); else hideConfirm();
    },
    onFieldComplete(text) {
      setMicState('idle');
      $('transcript-edit').value = text;
      confirmField(_autoAdvance);
    },
    onClearField() {
      const { key } = _fieldDefs[_currentIdx] || {};
      if (!key) return;
      $('transcript-edit').value = '';
      hideConfirm();
      toast('Câmp șters', 'info', 1500);
    },
    onPrevField() {
      if (_currentIdx > 0) {
        if (Voice.isRecording()) Voice.stop();
        setActiveField(_currentIdx - 1);
        toast('Câmp anterior', 'info', 1200);
      }
    },
    onGenerateDoc() {
      if (Voice.isRecording()) Voice.stop();
      renderPreview();
      showScreen('generate');
    },
    onError(err) {
      haptic([50, 80, 50]);
      setMicState('idle');
      $('recording-badge').classList.add('hidden');
      $('transcript-edit').classList.remove('recording');
      toast(err, 'error', 4000);
    },
  });

  $('btn-prev-field').addEventListener('click', () => {
    if (Voice.isRecording()) Voice.stop();
    if (_currentIdx > 0) setActiveField(_currentIdx - 1);
  });

  $('btn-next-field').addEventListener('click', () => {
    if (Voice.isRecording()) Voice.stop();
    if (_currentIdx < _fieldDefs.length - 1) setActiveField(_currentIdx + 1);
  });

  $('btn-mic').addEventListener('click', () => {
    if (!Voice.isSupported()) {
      toast('Microfon indisponibil în acest browser — scrie direct.', 'error');
      $('transcript-edit').focus();
      return;
    }
    if (Voice.isRecording()) {
      Voice.stop();
    } else {
      const currentText = $('transcript-edit').value.trim();
      currentText ? Voice.resume(currentText) : Voice.start();
    }
  });

  $('btn-continue').addEventListener('click', () => {
    if (!Voice.isSupported()) {
      toast('Microfon indisponibil în acest browser — scrie direct.', 'error');
      $('transcript-edit').focus();
      return;
    }
    const currentText = $('transcript-edit').value.trim();
    hideContinueBtn();
    Voice.resume(currentText);
  });

  // ── Session / navigation ──────────────────────────────────
  $('btn-new-session').addEventListener('click', async () => {
    if (Voice.isRecording()) Voice.stop();
    _aiCorrectedText = null;
    hideAiRevert();
    _fieldDefs.forEach(({ key }) => (_fields[key] = _lockedFields[key] || ''));
    _currentIdx = 0;
    await Storage.clearDraft(_templateId);
    renderFields();
    updateProgress();
    const firstUnlocked = _fieldDefs.findIndex(({ key }) => !(key in _lockedFields));
    await setActiveField(firstUnlocked >= 0 ? firstUnlocked : 0);
    const lockedCount = Object.keys(_lockedFields).length;
    toast(lockedCount ? `Sesiune nouă · ${lockedCount} câmp${lockedCount === 1 ? '' : 'uri'} pre-completate` : 'Sesiune nouă', 'info');
  });

  $('btn-back-upload').addEventListener('click', () => {
    if (Voice.isRecording()) Voice.stop();
    _aiCorrectedText = null;
    hideAiRevert();
    setConfirmProcessing(false);
    showScreen('upload');
    initUploadScreen();
  });

  $('btn-back-dictation').addEventListener('click', () => showScreen('dictation'));

  // ── Generate ──────────────────────────────────────────────
  $('btn-generate').addEventListener('click', () => {
    if (Voice.isRecording()) Voice.stop();
    renderPreview();
    showScreen('generate');
  });

  function renderPreview() {
    const c = $('doc-preview');
    c.innerHTML = '';
    _fieldDefs.forEach(({ key, label }) => {
      const isEmpty = !_fields[key];
      const div = document.createElement('div');
      div.className = 'preview-field';
      div.innerHTML = `
        <div class="preview-field-name">${escHtml(label)}${isEmpty ? ' <span style="color:#dc2626;font-size:0.7rem">(gol)</span>' : ''}</div>
        <div class="preview-field-value" style="${isEmpty ? 'color:#94a3b8;font-style:italic' : ''}">${escHtml(_fields[key] || '—')}</div>`;
      c.appendChild(div);
    });
  }

  function _buildFileName() {
    const patientRaw  = (_fields.pacient || _fields.patient || '').trim();
    const patientSlug = patientRaw.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '') || _templateName;
    const dateSlug    = new Date().toISOString().slice(0, 10);
    return `${patientSlug}_${dateSlug}`;
  }

  function showRenameModal() {
    $('modal-rename-input').value = _buildFileName();
    $('modal-rename').classList.remove('hidden');
    setTimeout(() => {
      const inp = $('modal-rename-input');
      inp.focus();
      inp.setSelectionRange(0, inp.value.length);
    }, 80);
  }

  function hideRenameModal() {
    $('modal-rename').classList.add('hidden');
  }

  async function doDownload(baseName) {
    const fileName = (baseName.trim() || _buildFileName()).replace(/\.docx$/i, '') + '.docx';
    $('btn-download-docx').disabled = true;
    try {
      const values = Object.fromEntries(_fieldDefs.map(({ key }) => [key, _fields[key] || '']));
      await DocGen.generateDOCX(_templateBuffer, values, fileName);
      await Storage.saveSession(_templateId, _templateName, values);
      await Storage.clearDraft(_templateId);
      toast('Document descărcat!', 'success');
    } catch (err) {
      toast(err.message, 'error', 5000);
    } finally {
      $('btn-download-docx').disabled = false;
    }
  }

  $('btn-download-docx').addEventListener('click', showRenameModal);

  $('modal-rename-backdrop').addEventListener('click', hideRenameModal);
  $('modal-rename-cancel').addEventListener('click', hideRenameModal);

  $('modal-rename-confirm').addEventListener('click', () => {
    const name = $('modal-rename-input').value;
    hideRenameModal();
    doDownload(name);
  });

  $('modal-rename-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { $('modal-rename-confirm').click(); }
    if (e.key === 'Escape') { hideRenameModal(); }
  });

  $('btn-copy-text').addEventListener('click', async () => {
    const lines = _fieldDefs
      .filter(({ key }) => _fields[key])
      .map(({ key, label }) => `${label}: ${_fields[key]}`);
    if (!lines.length) { toast('Niciun câmp completat.', 'error', 2000); return; }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('✓ Text copiat în clipboard', 'success', 2200);
    } catch {
      toast('Clipboard indisponibil în acest browser.', 'error', 3000);
    }
  });

  // ── Feature 1: Share DOCX via navigator.share() ───────────
  $('btn-share-doc').addEventListener('click', async () => {
    if (!navigator.share) {
      toast('Share indisponibil în acest browser. Folosiți descărcarea.', 'error', 3500);
      return;
    }
    const btn = $('btn-share-doc');
    btn.disabled = true;
    try {
      const fileName = _buildFileName() + '_completat.docx';
      const values   = Object.fromEntries(_fieldDefs.map(({ key }) => [key, _fields[key] || '']));
      const blob     = await DocGen.generateBlob(_templateBuffer, values);
      const file     = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        toast('Dispozitivul nu suportă partajarea fișierelor DOCX.', 'error', 3500);
        return;
      }
      await navigator.share({ files: [file], title: _templateName });
      await Storage.saveSession(_templateId, _templateName, values);
      await Storage.clearDraft(_templateId);
      toast('Document trimis!', 'success');
    } catch (err) {
      if (err.name !== 'AbortError') toast(err.message, 'error', 5000);
    } finally {
      btn.disabled = false;
    }
  });

  // ── Feature 4: Export PDF via window.print() ──────────────
  $('btn-export-pdf').addEventListener('click', () => {
    const container = $('print-container');
    const dateStr   = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const rows = _fieldDefs.map(({ key, label }) => {
      const val     = _fields[key] || '';
      const isEmpty = !val;
      return `<div class="print-field">
        <div class="print-field-label">${escHtml(label)}</div>
        <div class="print-field-value${isEmpty ? ' empty' : ''}">${escHtml(val || '—')}</div>
      </div>`;
    }).join('');
    container.innerHTML = `
      <div class="print-header">
        <div class="print-title">${escHtml(_templateName)}</div>
        <div class="print-date">${escHtml(dateStr)}</div>
      </div>
      ${rows}`;
    window.print();
  });

  $('btn-new-doc').addEventListener('click', () => {
    showScreen('upload');
    initUploadScreen();
  });

  // ── AI Revert button ──────────────────────────────────────
  $('btn-ai-revert').addEventListener('click', () => {
    if (_aiCorrectedText) {
      $('transcript-edit').value = _aiCorrectedText.original;
      _aiCorrectedText = null;
      hideAiRevert();
      doSaveField(_autoAdvance); // salvează originalul și avansează
    }
  });

  // ── AI Settings modal ─────────────────────────────────────
  function openAiSettings() {
    $('modal-ai-key-input').value = AI.getKey();
    refreshAiKeyHint($('modal-ai-key-input').value);
    $('modal-ai-settings').classList.remove('hidden');
    setTimeout(() => $('modal-ai-key-input').focus(), 80);
  }

  function closeAiSettings() {
    $('modal-ai-settings').classList.add('hidden');
  }

  function refreshAiKeyHint(val) {
    const hint = $('modal-ai-key-hint');
    if (!hint) return;
    const k = (val || '').trim();
    if (!k) {
      hint.textContent = 'Fără cheie — corecția AI este dezactivată.';
      hint.style.color = '';
    } else if (!k.startsWith('sk-ant-')) {
      hint.textContent = '⚠ Cheia trebuie să înceapă cu sk-ant-';
      hint.style.color = 'var(--color-danger)';
    } else {
      hint.textContent = '✓ Cheie validă — AI activ.';
      hint.style.color = 'var(--color-success)';
    }
  }

  function updateAiDot() {
    const btn = $('btn-open-ai-settings');
    if (!btn) return;
    let dot = btn.querySelector('.ai-enabled-dot');
    if (AI.isEnabled()) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'ai-enabled-dot';
        btn.appendChild(dot);
      }
    } else if (dot) {
      dot.remove();
    }
  }

  $('btn-open-ai-settings').addEventListener('click', openAiSettings);
  $('modal-ai-backdrop').addEventListener('click', closeAiSettings);
  $('modal-ai-cancel').addEventListener('click', closeAiSettings);
  $('modal-ai-save').addEventListener('click', () => {
    AI.setKey($('modal-ai-key-input').value);
    closeAiSettings();
    toast(AI.isEnabled() ? '✓ Corecție AI activată' : 'AI dezactivat', AI.isEnabled() ? 'success' : 'info', 2200);
    updateAiDot();
  });
  $('btn-show-key').addEventListener('click', () => {
    const inp = $('modal-ai-key-input');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  $('modal-ai-key-input').addEventListener('input', (e) => refreshAiKeyHint(e.target.value));
  $('modal-ai-key-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  $('modal-ai-save').click();
    if (e.key === 'Escape') closeAiSettings();
  });

  // ── Service Worker ────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }

  // ── Init ──────────────────────────────────────────────────
  initTheme();
  updateAiDot();
  initUploadScreen();

  if (!navigator.share) {
    const shareBtn = $('btn-share-doc');
    if (shareBtn) shareBtn.classList.add('hidden');
  }

  if (Voice.isSupported()) {
    Voice.loadModel();
    setMicState('idle');
  } else {
    $('btn-mic').disabled = true;
    const label = $('mic-label');
    if (label) label.textContent = 'Indisponibil';
  }
})();
