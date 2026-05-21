// Modul AI — apelează proxy-ul serverless /api/ai-correct
// Cheia Anthropic stă pe server (Vercel env var), niciodată în browser.

const AI = (() => {
  function isEnabled() { return true; }

  async function processField(fieldKey, fieldLabel, text) {
    if (!text || !text.trim()) return text;

    const res = await fetch('/api/ai-correct', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ fieldLabel, text: text.trim() }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.corrected || text;
  }

  return { isEnabled, processField };
})();
