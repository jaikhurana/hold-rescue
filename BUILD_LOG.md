# Build log: Hold Rescue

> **Research and product design (Claude on claude.ai, 1–5 Oct 2026):** problem discovery, a merchant interview, the MHA SOP and Supreme Court order, a review of platform gaps, choosing Hold Rescue over other ideas, the product scope, and the design direction. **Build (Claude Code, from scratch, starting 5 Oct 2026):** everything in this repository.

The brief the build started from is in [docs/brief.md](docs/brief.md). Each entry below is one milestone.

---

## Setup

- **When / goal:** 5 Oct 2026. Get a clean machine ready to build and ship.
- **What I asked:** "Build and ship Hold Rescue from scratch, including the setup" (the full brief).
- **What Claude did:** Checked `node -v` (v26.5.0), `npm -v` (11.17.0), `git --version` (2.50.1), `gh --version` (2.102.0); confirmed git identity, `gh auth status` and `npx vercel whoami` were already logged in; ran `gh auth setup-git`. Created `~/Documents/hold-rescue`, copied the brief to `docs/brief.md`, wrote `.gitignore` (`.env*`, `node_modules`, `.vercel`, `test-results`, `playwright-report`, `.DS_Store`) **before** creating `.env.local`, and opened `.env.local` in the default editor for the key.
- **Decisions and trade-offs:** The session started in a temporary workspace that is deleted when the session ends, so Claude asked where the project should live and moved it to `~/Documents`. The Groq key was never pasted into chat: Claude only ever checked it with `grep -q '^GROQ_API_KEY=..*' .env.local && echo set || echo missing`. Claude checked that TASA Orbiter, Inter and Mukta resolve on Google Fonts before planning around them.
- **How it was verified:** Command output for every tool and login; key status reported as `set`.
- **Real versus simulated:** All real.

## Plan (agreed before any app code)

- Screens are rendered from one state object in JS rather than hand-written in `index.html`, because nearly every screen changes with the hold's state (on hold → under review → released).
- `app.js` is split into a few native ES modules (no bundler). Pure text functions live in `statement.js` so `node --test` can test them without a DOM.
- Local dev uses a tiny Node server that imports the same `api/*.js` modules, instead of `vercel dev`, so the Vercel project is only linked at deploy time with explicit approval.
- `.vercelignore` as a second guard so `.env*` can never be uploaded.
- **Added at the owner's request:** a cap on Redraft (which skips the cache), so a public link can't drain the free Groq quota.

## M0 · Repo

- **When / goal:** 5 Oct 2026. A git repo whose first commit already ignores secrets.
- **What I asked:** Initialise the repo and make the first commit.
- **What Claude did:** `git init -b main`; `git check-ignore .env.local` (confirmed ignored); committed `.gitignore`, `docs/brief.md` and this log.
- **Decisions and trade-offs:** `.gitignore` existed before `.env.local`, so there was never a moment where the key file could be staged.
- **How it was verified:** `git check-ignore -v .env.local` names the `.env*` rule; `git status` shows only the three intended files.
- **Real versus simulated:** Real.

## M1 · Prove the model

- **When / goal:** 5 Oct 2026. Confirm the open model the brief names is really available on the free tier, and that streaming works, before writing any app code.
- **What I asked:** List Groq models, confirm the two IDs, make one tiny streaming request.
- **What Claude did:** Wrote `scripts/check-groq.js` and ran it with `node --env-file=.env.local scripts/check-groq.js`. The key moves from the file into the process environment and is never printed.
- **Decisions and trade-offs:** The check uses exactly the request shape the app will use (`stream: true`, `reasoning_effort: "low"`, `include_reasoning: false`), so it proves those parameters are accepted. It is kept in the repo so anyone with their own key can re-run it.
- **How it was verified (real API calls):**
  - `GET /models` → 200, 11 models. gpt-oss models listed: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `openai/gpt-oss-safeguard-20b`.
  - `openai/gpt-oss-120b` → 200 `text/event-stream`; first token 467 ms, done 479 ms; text "Hold Rescue is connected."; 0 reasoning deltas.
  - `openai/gpt-oss-20b` → 200 `text/event-stream`; first token 411 ms, done 420 ms; same text; 0 reasoning deltas.
  - Rate-limit headers on the free tier: 1,000 requests/day and 8,000 tokens/min, matching the brief.
- **Real versus simulated:** Real.
