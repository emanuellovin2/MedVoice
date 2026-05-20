const Storage = (() => {
  const DB_NAME           = 'medvoice-db';
  const DB_VERSION        = 4;
  const STORE_TEMPLATES   = 'templates';
  const STORE_SESSIONS    = 'sessions';
  const STORE_DRAFTS      = 'drafts';
  const STORE_SUGGESTIONS = 'suggestions';
  const STORE_LOCKED      = 'lockedFields';

  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
          db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          db.createObjectStore(STORE_DRAFTS, { keyPath: 'templateId' });
        }
        if (!db.objectStoreNames.contains(STORE_SUGGESTIONS)) {
          db.createObjectStore(STORE_SUGGESTIONS, { keyPath: 'fieldKey' });
        }
        if (!db.objectStoreNames.contains(STORE_LOCKED)) {
          db.createObjectStore(STORE_LOCKED, { keyPath: 'templateId' });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async function _tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(store, mode);
      const s   = tx.objectStore(store);
      const req = fn(s);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Templates ──────────────────────────────────────────────
  async function saveTemplate(name, fileName, fields, rawBytes) {
    return _tx(STORE_TEMPLATES, 'readwrite', (s) =>
      s.add({ name, fileName, fields, rawBytes, savedAt: Date.now() })
    );
  }

  async function getTemplates() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_TEMPLATES, 'readonly').objectStore(STORE_TEMPLATES).getAll();
      req.onsuccess = (e) => {
        const all = e.target.result || [];
        all.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.savedAt - a.savedAt);
        resolve(all);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function deleteTemplate(id) {
    return _tx(STORE_TEMPLATES, 'readwrite', (s) => s.delete(id));
  }

  async function pinTemplate(id, pinned) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_TEMPLATES, 'readwrite');
      const s   = tx.objectStore(STORE_TEMPLATES);
      const get = s.get(id);
      get.onsuccess = () => {
        const rec = get.result;
        if (!rec) { resolve(); return; }
        rec.pinned = pinned;
        const put = s.put(rec);
        put.onsuccess = () => resolve();
        put.onerror   = (e) => reject(e.target.error);
      };
      get.onerror = (e) => reject(e.target.error);
    });
  }

  async function saveSession(templateId, templateName, values) {
    return _tx(STORE_SESSIONS, 'readwrite', (s) =>
      s.add({ templateId, templateName, values, savedAt: Date.now() })
    );
  }

  async function getSessions(limit = 20) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_SESSIONS, 'readonly').objectStore(STORE_SESSIONS).getAll();
      req.onsuccess = (e) => {
        const all = e.target.result || [];
        all.sort((a, b) => b.savedAt - a.savedAt);
        resolve(all.slice(0, limit));
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function deleteSession(id) {
    return _tx(STORE_SESSIONS, 'readwrite', (s) => s.delete(id));
  }

  // ── Drafts — autosave sesiune în curs ──────────────────────
  async function saveDraft(templateId, fields) {
    return _tx(STORE_DRAFTS, 'readwrite', (s) =>
      s.put({ templateId, fields, updatedAt: Date.now() })
    );
  }

  async function getDraft(templateId) {
    return _tx(STORE_DRAFTS, 'readonly', (s) => s.get(templateId)).catch(() => null);
  }

  async function clearDraft(templateId) {
    return _tx(STORE_DRAFTS, 'readwrite', (s) => s.delete(templateId)).catch(() => {});
  }

  // ── Suggestions — valori frecvente per câmp ─────────────────
  async function addSuggestion(fieldKey, text) {
    if (!text || text.trim().length < 3) return;
    const db = await open();
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE_SUGGESTIONS, 'readwrite');
      const s   = tx.objectStore(STORE_SUGGESTIONS);
      const get = s.get(fieldKey);
      get.onsuccess = () => {
        const rec = get.result || { fieldKey, values: [] };
        const idx = rec.values.findIndex((v) => v.text === text);
        if (idx >= 0) {
          rec.values[idx].count++;
          rec.values[idx].lastUsed = Date.now();
        } else {
          rec.values.push({ text, count: 1, lastUsed: Date.now() });
        }
        rec.values.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
        rec.values = rec.values.slice(0, 20);
        s.put(rec);
        resolve();
      };
      get.onerror = () => resolve();
    });
  }

  async function getSuggestions(fieldKey, limit = 5) {
    const rec = await _tx(STORE_SUGGESTIONS, 'readonly', (s) => s.get(fieldKey)).catch(() => null);
    if (!rec) return [];
    return rec.values.slice(0, limit).map((v) => v.text);
  }

  // ── Locked fields — valori fixe per template ───────────────
  async function getLockedFields(templateId) {
    const rec = await _tx(STORE_LOCKED, 'readonly', (s) => s.get(templateId)).catch(() => null);
    return rec ? rec.fields : {};
  }

  async function setLockedFields(templateId, fields) {
    return _tx(STORE_LOCKED, 'readwrite', (s) => s.put({ templateId, fields }));
  }

  return {
    saveTemplate, getTemplates, deleteTemplate, pinTemplate,
    saveSession, getSessions, deleteSession,
    saveDraft, getDraft, clearDraft,
    addSuggestion, getSuggestions,
    getLockedFields, setLockedFields,
  };
})();
