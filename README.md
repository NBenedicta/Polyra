# Polyra — Language Translator

**🔗 Live: [polyra.netlify.app](https://polyra.netlify.app)**

A clean, single-page translator supporting 25 languages, backed by the DeepL API for
high-quality machine translation.

## Features

- Translate between 25 languages, including English, Spanish, French, German,
  Mandarin, Japanese, Arabic, Hindi, Swahili, Zulu, and more
- Auto-detect the source language
- **Conversation mode** — two people take turns speaking (or typing); each turn is
  translated and read aloud for the other person, shown as a chat transcript
- **Voice input** — dictate instead of typing (Chrome, Edge, Safari)
- **Read aloud** — hear the source or the translation spoken by your device's voices
- **Formal / informal tone** — for German, French, Italian, Spanish, Dutch, Polish,
  Portuguese, Japanese and Russian
- **History & saved translations** — recent translations and starred favourites,
  kept in your browser
- **Light and dark themes**, following your system setting by default
- One-click swap between source and target, copy to clipboard, Ctrl+Enter to translate
- Responsive UI — works on mobile, tablet, and desktop
- Graceful error handling if the translation service is unavailable

## Tech stack

- **Frontend:** HTML, CSS, vanilla JavaScript — no framework, no build step
- **Translation engine:** [DeepL API](https://www.deepl.com/en/pro-api) (primary),
  with [MyMemory](https://mymemory.translated.net/) as an automatic fallback for the
  two languages DeepL doesn't yet support (Yoruba, Amharic)
- **Backend:** a single serverless function (deployed on Netlify Functions) that
  proxies translation requests so the API key never reaches the browser
- **Hosting:** [Netlify](https://www.netlify.com/), deployed straight from this repo

## How it works

```
Browser (script.js)
   │  POST /api/translate  { text, source, target }
   ▼
Netlify Function (netlify/functions/translate.js)
   │  looks up DEEPL_API_KEY from environment
   ▼
DeepL API  ──(unsupported language)──▶  MyMemory API
   │
   ▼
{ translatedText, detectedSourceLang }
```

## Run it yourself

```bash
git clone https://github.com/NBenedicta/polyra.git
cd polyra
npx netlify-cli dev   # serves the site + the function locally
```

You'll need a free DeepL API key — sign up at
[deepl.com/en/pro-api](https://www.deepl.com/en/pro-api), then add it to a local
`.env` file:

```
DEEPL_API_KEY=your-key-here
```

## Deploy your own copy

1. Fork/clone this repo, push it to your own GitHub
2. On [Netlify](https://app.netlify.com), **Add new site → Import an existing project → Deploy with GitHub**, pick the repo
3. In **Site configuration → Environment variables**, add `DEEPL_API_KEY` with your key
4. Trigger a deploy

Full details are in [`DEPLOY.md`](DEPLOY.md).

---

Built by [NBenedicta](https://github.com/NBenedicta).
