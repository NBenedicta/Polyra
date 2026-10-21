// Vercel Serverless Function — thin adapter around lib/translate-core.js.
// Requires env var DEEPL_API_KEY set in Project settings → Environment Variables.

const { DEEPL_UNSUPPORTED, translateWithDeepL, translateWithMyMemory } = require('../lib/translate-core');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload || '{}');
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }

  const { text, source, target, formality } = payload || {};

  if (!text || !target) {
    res.status(400).json({ error: 'Missing text or target language' });
    return;
  }

  const needsFallback =
    DEEPL_UNSUPPORTED.has(target) || (source && source !== 'auto' && DEEPL_UNSUPPORTED.has(source));

  try {
    const result = needsFallback
      ? await translateWithMyMemory(text, source, target)
      : await translateWithDeepL(text, source, target, formality);
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Translation failed' });
  }
};
