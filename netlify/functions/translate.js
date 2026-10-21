// Netlify Function — thin adapter around lib/translate-core.js.
// Requires env var DEEPL_API_KEY set in Site settings → Environment variables.

const { DEEPL_UNSUPPORTED, translateWithDeepL, translateWithMyMemory } = require('../../lib/translate-core');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { text, source, target, formality } = payload;

  if (!text || !target) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing text or target language' }) };
  }

  const needsFallback =
    DEEPL_UNSUPPORTED.has(target) || (source && source !== 'auto' && DEEPL_UNSUPPORTED.has(source));

  try {
    const result = needsFallback
      ? await translateWithMyMemory(text, source, target)
      : await translateWithDeepL(text, source, target, formality);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message || 'Translation failed' }) };
  }
};
