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

## M2 · Skeleton and design system

- **When / goal:** 5 Oct 2026. The look, layout and navigation everything else hangs on, plus the lock and home screens.
- **What I asked:** Tokens, fonts, phone frame and rail layout, both themes, phone-width behaviour, navigation and transitions, lock and home.
- **What Claude did:** Wrote `index.html` (presenter rail as plain markup, phone shell with fake status bar, concept strip, toast and sheet layers), `styles.css` (Blade colour tokens for light and dark, frame, rail, components), `icons.js` (hand-drawn 1.8-stroke line icons), `case-data.js` (all fictional data in one module, including the scripted statements and timeline for later milestones), `screens.js` (one render function per screen), `app.js` (state, back stack, transitions, toasts, rail sheet), and `scripts/dev-server.js`.
- **Decisions and trade-offs:**
  - Screens render from one state object, so the alert card, tab count, chip and badges all change together when the hold's state changes.
  - The status bar and strip are overlays; each screen pads its top by `--top`, so the lock wallpaper and navy hero run under the status bar as the brief asks, while app bars stay solid.
  - The phone frame is 414 × min(868, 100dvh − 56) outside with a 12 px bezel, which gives a 390 × 844 screen inside (an iPhone 14).
  - The local dev server imports the same `api/*.js` modules Vercel will run, and refuses dotfiles and path traversal, so `.env.local` can't be served by accident. Checked with curl: `/.env.local`, `/%2eenv.local` and `/../../etc/passwd` all return 404.
  - Copy fix: the scripted "attach" sentence says "screenshot of our conversation" only when the merchant tagged the upload as the exchange request, and otherwise "a screenshot from my phone", so the standard draft never claims more than the merchant said.
- **How it was verified:** In the in-app browser at 1440×900 (light and dark) and at 390×844 and 360×740: lock → alert → back to Home; the quick-action toast; the Demo controls sheet opens with focus on Close, makes the phone inert, and Escape closes it and returns focus. Measured: `scrollWidth` equals viewport width at 360 and 390, the Demo controls pill is 40 px tall, and no element overflows the viewport.
- **Real versus simulated:** Everything on screen is fictional data; the status bar is drawn.

## M3 · Hold flow

- **When / goal:** 5 Oct 2026. From the alert to a complete case file: Holds tab, Hold detail, Case file, and the "Add from your phone" sheet.
- **What I asked:** Build screens 3–6 of the brief, with the staggered reveal and both the sample screenshots and a real upload with tagging.
- **What Claude did:** Added the four screens and the sheet to `screens.js`; sheet state, the 1.5 s "reading" step, the file picker, object URLs and E5 handling to `app.js`; styles for the ledger, deadline banner, a navy "government file" cover with dashed form lines, evidence cards, the dashed amber missing card, and the sheet.
- **Decisions and trade-offs:**
  - The sample chat screenshot is drawn once in HTML/CSS with every size in container-query units (`cqw`), so the same markup is a 56 px thumbnail in the case file, a 111 px tile in the sheet and a large preview while "reading". It's a generic chat look, not a copy of any real app.
  - Tagging a real upload adds it straight away (one tap, not pick-then-confirm), to keep the flow under two minutes.
  - The cover's STATUS line says "Exchange dispute, not fraud" only when E5 is the chat or is tagged as the exchange request. For other tags it says "Ordered, paid and delivered", matching what the statement is allowed to claim.
  - Uploaded images stay in the browser as object URLs; nothing is uploaded. URLs are revoked when replaced or discarded.
  - The timer start is recorded the first time Hold detail opens (shown in M6).
- **How it was verified:** In the in-app browser at 1440×900 (light) and 390×844 (dark): lock → Hold detail → Case file (stagger plays once) → sheet (focus moves to the sheet title, the screen behind is inert, rail shows step 4) → product-photo toast → chat "reading" → "What it shows" → Add → toast, 5 of 5 ready, focus on "Draft my statement". Real-upload path checked by injecting a generated PNG into the file input: the tag view showed the image, "Delivery proof" added E5 as a tagged upload. Two layout bugs found and fixed: flex children of the scrolling body were shrinking (squashing the file cover), and the blockquote kept browser-default margins.
- **Real versus simulated:** The screenshot "reading" is simulated (a fixed result after 1.5 s); the brief puts reading uploads with AI out of scope. The real upload is genuinely picked and shown, but never read or sent.

## M4 · Statement and AI

- **When / goal:** 5 Oct 2026. The merchant's statement, drafted live by an open model from the case file only, with a fallback that never dead-ends.
- **What I asked:** `case-data.js`, `api/draft.js`, `api/health.js`, the streaming client, proof chips, EN/हिंदी, Edit/Shorter/Redraft/Stop and the scripted fallback; confirm real drafts stream in both languages.
- **What Claude did:** `api/draft.js` (whitelist, 2 KB cap read incrementally, prompt built from `case-data.js`, Groq streaming with 120b → 20b fallback, SSE relay, 24 h cache, Redraft cap), `api/health.js`, `lib/models.js` (model order and `GROQ_MODEL` override), `statement.js` (pure text functions: `cleanDraft`, `scriptedStatement`, `typedSlice`, `wordCount`), `draft-client.js` (SSE reader with 30 s first-token and 90 s total aborts), and the statement screen in `screens.js` / `app.js`.
- **Decisions and trade-offs (found by testing against the real model):**
  - **Empty drafts.** With a strict word limit, gpt-oss-120b sometimes spent its whole 1,000-token budget on hidden reasoning and returned nothing (`finish_reason: length`, 2 of 2 runs for "Shorter"). Fix in two layers: phrase length as a sentence count plus a word range, and have the server commit to a model only once it produces text. If 120b returns nothing, 20b gets a turn in the same request, all inside one shared 28 s deadline.
  - **Loose structure.** A list of rules gave drafts that sometimes skipped the "not fraud" line, put tags after the full stop, ran to 200+ words or dropped tags. Replaced with a **sentence plan**: a numbered list of what each sentence covers and which tag it cites, leading with delivery proof and the customer's own exchange request. Hindi also gets a worked tag example and the word "रोक" for the hold. Measured afterwards: English 6/6 and Hindi 5/5 drafts cite their tags in order; English 124–160 words, Hindi 155–177, Shorter 64–93.
  - **Guardrails.** The client drops any tag that isn't in the case file and normalises tag shapes (`[E1, E2]`, `[E1–E3]`, `【E1】`, `(E1)`). A finished live draft with no tags, or under 20 words, is replaced by the standard draft with an honest toast ("…didn't cite its proof…"). The server only caches drafts that cite a tag, so a weak draft is never served twice.
  - **Redraft cap** (agreed in the plan): Redraft skips the cache, so it is limited to 6 a minute per visitor and 30 a minute per instance (Groq's free-tier rate). Over the cap, Redraft quietly returns the saved draft.
  - **Streaming UI.** Tokens update only the text and source regions; the buttons re-render only when the phase changes, so a tap on Stop is never lost to a re-render. The typewriter uses a timer, not `requestAnimationFrame`, because rAF pauses in background tabs. Testing caught a draft stuck at 0 characters for exactly that reason.
- **How it was verified:** curl: `/api/health` → `{"ok":true,"ai":true,"model":"gpt-oss-120b"}`; GET → 405; bad JSON and array bodies → 400; a 3 KB body → 413, including chunked with no content-length; extra fields such as `prompt` and `system` are ignored. Real streamed drafts in English, Hindi, Shorter, no-E5 and tagged-upload cases (first text in 0.7–1.6 s); a repeat request returned `x-cache: hit` in 27 ms. In the browser: proof chip toast, EN → हिंदी (cancels and redrafts), Shorter toggle, Edit (Submit disabled while editing; an invented `[E9]` typed by hand is stripped), Stop mid-stream, Redraft, and `/api/draft` forced to 503 → scripted typewriter plus toast.
- **Real versus simulated:** Drafting is real (gpt-oss-120b on Groq). The scripted statement is pre-written and used only when AI is off or fails, and it is labelled "Standard draft from your case file".

## M5 · Submit to outcome

- **When / goal:** 5 Oct 2026. Finish the story: review, submit, track to release, see the result, and measure the time.
- **What I asked:** Review, Submitted, Tracker with stages and push banners, Outcome, and the timer.
- **What Claude did:** Added screens 8–11 and the push banner to `screens.js`; submit (1.3 s "Sending your case file…"), the timer, Advance time and the banner logic to `app.js`; styles for the route, declaration, popping success check, timeline (done, now and next marks) and banner.
- **Decisions and trade-offs:**
  - The timer starts the first time Hold detail opens and stops the moment Submit is tapped, before the 1.3 s fake send, so the measured time is the merchant's own. The same value appears in the rail, on Submitted ("0:14"), in the tracker ("sent in 14 s") and on Outcome. It is hidden wherever no time was measured.
  - The tracker's timeline comes from one function in `case-data.js` (`timeline(stage, sentIn)`), so the dates the brief specifies live in one place. Screen readers hear each step's state ("Done", "In progress", "Up next").
  - After submit the back stack is reset to Home, so Back never returns to a form that has already been sent.
  - Small fix found on screen: value cells in the facts lists were flex boxes, which put a double gap in "162  words". Flex is now opt-in for cells with an icon.
- **How it was verified:** Full run in the in-app browser at 1440×900 (light): live draft → Review (Submit disabled until the declaration is ticked; 5 items; live word count 162; call-time chips) → Submit → Submitted (0:14, "Under the 2-minute goal"; rail timer stopped; rail button "Advance to Tue 6 Oct") → Tracker → Skip ahead (stage 1, "Grievance filed" banner) → Advance (stage 2, "Video call booked", 3-item checklist) → Advance (stage 3, "Hold lifted: ₹1,800 is yours" banner, Released badge, three later steps faded, "See the result") → Outcome (14 s · 11 days · Fri 16 Oct 2026 · ₹3,750 on 2 holds) → Done → Holds tab (Recovered ₹1,800, "Resolved", no red count) → Home ("HOLD LIFTED", chip "₹1,800 released"). Outcome checked again at 390×844 in dark mode.
- **Real versus simulated:** Submitting sends nothing ("Prototype: nothing is actually sent."). Filing, the video call and the release are a scripted story moved along by "Advance time".
