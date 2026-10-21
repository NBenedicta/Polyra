// Shared translation logic used by both the Netlify function
// (netlify/functions/translate.js) and the Vercel function (api/translate.js).
//
// Primary engine: DeepL — high quality, requires a free API key.
// Fallback engine: MyMemory — used only for the two languages DeepL doesn't
// support (Yoruba, Amharic), since it needs no key.

// DeepL doesn't (yet) support these two of our 25 languages.
const DEEPL_UNSUPPORTED = new Set(['yo', 'am']);

// Our internal 2-letter codes -> DeepL's target_lang codes.
// DeepL requires specific regional variants for English and Portuguese targets.
const DEEPL_TARGET_MAP = {
  en: 'EN-US', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', pt: 'PT-PT',
  zh: 'ZH-HANS', ja: 'JA', ko: 'KO', ar: 'AR', hi: 'HI', ru: 'RU',
  nl: 'NL', sv: 'SV', tr: 'TR', pl: 'PL', vi: 'VI', th: 'TH', id: 'ID',
  ig: 'IG', ha: 'HA', sw: 'SW', zu: 'ZU',
};

// Our internal 2-letter codes -> DeepL's source_lang codes (no regional variants).
const DEEPL_SOURCE_MAP = {
  en: 'EN', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', pt: 'PT',
  zh: 'ZH', ja: 'JA', ko: 'KO', ar: 'AR', hi: 'HI', ru: 'RU',
  nl: 'NL', sv: 'SV', tr: 'TR', pl: 'PL', vi: 'VI', th: 'TH', id: 'ID',
  ig: 'IG', ha: 'HA', sw: 'SW', zu: 'ZU',
};

// Requested tone -> DeepL formality value. The "prefer_" variants make DeepL
// quietly fall back to the default tone for languages without formality
// support, instead of rejecting the request.
const DEEPL_FORMALITY_MAP = {
  more: 'prefer_more',
  less: 'prefer_less',
};

// Minimal script-based detector, used only as a last resort when MyMemory
// is handling an "Auto-Detect" request (DeepL does real detection itself).
const SCRIPT_TESTS = [
  { code: 'ja', re: /[぀-ヿ]/ },
  { code: 'zh', re: /[一-鿿]/ },
  { code: 'ko', re: /[가-힯]/ },
  { code: 'ar', re: /[؀-ۿ]/ },
  { code: 'ru', re: /[Ѐ-ӿ]/ },
  { code: 'hi', re: /[ऀ-ॿ]/ },
  { code: 'th', re: /[฀-๿]/ },
  { code: 'am', re: /[ሀ-፿]/ },
];

function detectLanguageLocally(text) {
  for (const test of SCRIPT_TESTS) {
    if (test.re.test(text)) return test.code;
  }
  return 'en';
}

async function translateWithDeepL(text, source, target, formality) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new Error('Server is missing DEEPL_API_KEY. Set it in your hosting dashboard.');
  }

  const targetCode = DEEPL_TARGET_MAP[target];
  if (!targetCode) {
    throw new Error(`Unsupported target language: ${target}`);
  }

  const base = apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

  const params = new URLSearchParams();
  params.set('text', text);
  params.set('target_lang', targetCode);
  if (source && source !== 'auto' && DEEPL_SOURCE_MAP[source]) {
    params.set('source_lang', DEEPL_SOURCE_MAP[source]);
  }
  if (DEEPL_FORMALITY_MAP[formality]) {
    params.set('formality', DEEPL_FORMALITY_MAP[formality]);
  }

  const res = await fetch(`${base}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `DeepL error (HTTP ${res.status})`);
  }

  const translation = data.translations && data.translations[0];
  if (!translation) {
    throw new Error('DeepL returned no translation.');
  }

  return {
    translatedText: translation.text,
    detectedSourceLang: translation.detected_source_language
      ? translation.detected_source_language.toLowerCase()
      : source,
    engine: 'deepl',
  };
}

async function translateWithMyMemory(text, source, target) {
  const sourceCode = source && source !== 'auto' ? source : detectLanguageLocally(text);
  const langpair = `${sourceCode}|${target}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MyMemory network error (HTTP ${res.status})`);
  }

  const data = await res.json();
  const status = Number(data.responseStatus);
  if (status !== 200) {
    throw new Error((data.responseDetails && String(data.responseDetails)) || 'MyMemory returned an error.');
  }

  const translated = data.responseData && data.responseData.translatedText;
  if (!translated) {
    throw new Error('MyMemory returned no translation.');
  }

  return {
    translatedText: translated,
    detectedSourceLang: sourceCode,
    engine: 'mymemory',
  };
}

module.exports = {
  DEEPL_UNSUPPORTED,
  DEEPL_TARGET_MAP,
  DEEPL_SOURCE_MAP,
  translateWithDeepL,
  translateWithMyMemory,
};
