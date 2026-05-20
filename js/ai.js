const AI = (() => {
  const STORAGE_KEY = 'medvoice-ai-key';
  const API_URL     = 'https://api.anthropic.com/v1/messages';
  const MODEL       = 'claude-haiku-4-5-20251001';

  function getKey()    { return localStorage.getItem(STORAGE_KEY) || ''; }
  function setKey(k) {
    const t = (k || '').trim();
    t ? localStorage.setItem(STORAGE_KEY, t) : localStorage.removeItem(STORAGE_KEY);
  }
  function isEnabled() { return !!getKey(); }

  async function processField(fieldKey, fieldLabel, text) {
    const apiKey = getKey();
    if (!apiKey || !text || !text.trim()) return text;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: `Ești un corector medical specializat în română. Câmpul curent: "${fieldLabel}". Corectează ortografia, diacriticele, punctuația și termenii medicali. Nu adăuga și nu elimina informații. Returnează EXCLUSIV textul corectat, fără explicații sau prefix.`,
        messages: [{ role: 'user', content: text.trim() }],
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }

    const data      = await res.json();
    const corrected = (data.content?.[0]?.text || '').trim();
    return corrected || text;
  }

  return { getKey, setKey, isEnabled, processField };
})();
