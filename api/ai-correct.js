// Vercel Serverless Function — proxy Anthropic API
// Cheia API stă în ANTHROPIC_API_KEY (Environment Variable), niciodată în browser.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-haiku-4-5-20251001';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { fieldLabel = 'câmp', text } = req.body || {};
  if (!text || !text.trim())
    return res.status(400).json({ error: 'Text lipsă' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: 'Cheie API neconfigurată pe server' });

  const upstream = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 512,
      system: `Ești un corector medical specializat în română. Câmpul curent: "${fieldLabel.replace(/"/g, '')}". Corectează ortografia, diacriticele, punctuația și termenii medicali. Nu adăuga și nu elimina informații. Returnează EXCLUSIV textul corectat, fără explicații sau prefix.`,
      messages: [{ role: 'user', content: text.trim() }],
    }),
  });

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json({
      error: body.error?.message || `Anthropic HTTP ${upstream.status}`,
    });
  }

  const data      = await upstream.json();
  const corrected = (data.content?.[0]?.text || '').trim();
  return res.status(200).json({ corrected: corrected || text });
};
