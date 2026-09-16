# Vault Cracker

A Wordle-style word-guessing game with AI-generated puzzles (via Claude), a
shared leaderboard, difficulty levels, and a mechanical-vault UI.

This is a single project — the game (Vite + React) and the AI word generator
(`/api/generate-word.js`) deploy together as one Vercel site. No separate
backend server to run.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new and import the repo. Vercel auto-detects
   Vite and the `/api` folder — no configuration needed.
3. Before (or right after) the first deploy, go to
   **Project → Settings → Environment Variables** and add:
   - `GEMINI_API_KEY` = a free key from https://aistudio.google.com/apikey (no credit card required)
4. Deploy. Your game will be live at `your-project.vercel.app`, with word
   generation running through your own serverless function.

## Run locally

```
npm install
cp .env.example .env      # then paste your real Gemini API key into .env
npm start
```

That's it — `npm start` runs the frontend and the AI word API together at
http://localhost:3000, no Vercel CLI or login needed for local testing.

If you just want to poke at the UI without AI words, `npm run dev` (plain
Vite, frontend only) also works — the game automatically falls back to a
small built-in word list whenever the API call fails.

### Testing against the real Vercel runtime (optional)

`npm start` uses a lightweight local server that reuses the same
`api/generate-word.js` code Vercel runs in production, so it's a very close
match. If you want to test the *exact* Vercel serverless environment before
deploying, you can alternatively use the Vercel CLI:

```
npm install -g vercel
vercel dev
```

## Notes

- The leaderboard uses the browser's `localStorage`, so it's per-browser,
  not shared across visitors to your deployed site. If you want a real
  cross-visitor leaderboard, swap the storage calls in `src/App.jsx` for a
  database (e.g. Vercel KV, Postgres, or Supabase).
- The AI model used is `gemini-3.8-flash` via the Gemini API's free tier —
  no billing setup required to get started. Free tier requests are
  rate-limited (fewer requests per minute/day than a paid plan), which is
  plenty for personal or small-audience use.
