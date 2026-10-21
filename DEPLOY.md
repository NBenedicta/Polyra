# Deploying Polyra

This project needs one serverless function (`/api/translate`) to keep the DeepL API
key off the client, so deployment is a Git-connected build rather than a plain
drag-and-drop of static files.

## 1. Get a free DeepL API key

1. Sign up at [deepl.com/en/pro-api](https://www.deepl.com/en/pro-api) for **DeepL API Free**
   (500,000 characters/month, no cost — some signup flows ask for a card for
   verification, but you're not charged unless you separately upgrade)
2. Copy your key from [deepl.com/en/your-account/keys](https://www.deepl.com/en/your-account/keys)
   — free-tier keys end in `:fx`

## 2. Deploy

### Netlify (what this project uses)

1. Push this repo to your own GitHub account
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → Deploy with GitHub** → pick the repo
3. **Site configuration → Environment variables → Add a variable**
   — Key: `DEEPL_API_KEY`, Value: your key, "Same value for all deploy contexts"
4. **Deploys → Trigger deploy → Deploy site**
5. Once published, make sure the site is set to **public** (not private) if you want
   it reachable without logging into Netlify

### Vercel

1. `npx vercel --prod`, or import the repo at [vercel.com/new](https://vercel.com/new)
2. Project Settings → Environment Variables → add `DEEPL_API_KEY`
3. Redeploy

### GitHub Pages

Won't work — GitHub Pages only serves static files and can't run
`api/translate.js`. Use Netlify or Vercel instead.

## Test locally

```
npx netlify-cli dev
```

or

```
npx vercel dev
```

Put your key in a `.env` file first (see `.env.example`):

```
DEEPL_API_KEY=your-key-here
```

## Notes

- **Auto-Detect** is handled by DeepL itself (reliable, no client-side guessing).
- **Yoruba and Amharic** aren't supported by DeepL yet, so those two automatically
  fall back to MyMemory — quality for just those two is more variable than the rest.
- If `DEEPL_API_KEY` isn't set, DeepL-covered languages return a clear error message
  explaining that, rather than failing silently.
