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

## M6 · Presenter rail

- **When / goal:** 5 Oct 2026. Let a presenter drive the demo: jump to any step, restart, move time forward, and choose live or scripted drafting.
- **What I asked:** Steps and jumps, Restart, Advance time, the AI toggle and status, notes, and the bottom sheet on phones.
- **What Claude did:** `jump()`, `restart()` and `syncAi()` in `app.js`; the rail markup was already plain HTML in `index.html` (pitch, timer, seven steps, notes, fine print with "not a Razorpay product").
- **Decisions and trade-offs:**
  - A jump fills in what the earlier steps would have produced and nothing more. Step 5 and later add the sample chat as E5 only if none was added. Step 6 and later use the scripted statement only if no draft exists, so a live draft is kept. Step 7 marks the response submitted and stops a running timer.
  - Restart keeps the presenter's settings (Live/Scripted mode and model status) but resets the story, timer, uploads and drafts.
  - Scripted mode makes no network calls at all, so a recording is identical every time.
  - On phones, a jump closes the Demo controls sheet and moves focus to the new screen's heading.
- **How it was verified:** In the in-app browser: the status line on load reads "Live: gpt-oss-120b, an open model running on Groq…" (from `/api/health`); jumping 2 → 3 → 4 → 5 → 6 → 7 → 1 lands on the right screen with the right rail step each time (4 opens the sheet; 5 adds the chat; 7 sets submitted); Restart → lock screen, timer 0:00, Advance disabled. Scripted mode: 0 calls to `/api/draft`, typewriter, no toast, "Standard draft from your case file". Phone width: a jump from the sheet closes it and focuses the Review heading.
- **Real versus simulated:** The rail is presenter tooling, not part of the merchant's app.

## M7 · Tests

- **When / goal:** 5 Oct 2026. Everything green before anything is deployed.
- **What I asked:** `node --test` unit tests for the draft function with a mocked `fetch` and for the browser's text cleaning; Playwright end-to-end tests at 390×844 and 1440×900; `npm test` and `npm run test:e2e`.
- **What Claude did:** `tests/unit/draft.test.js` (19 tests), `tests/unit/statement.test.js` (11), `tests/unit/draft-client.test.js` (3), `playwright.config.js` and `tests/e2e/flow.spec.js` (6 tests × 2 viewports). Installed `@playwright/test` (the only dev dependency) and its headless Chromium.
- **What the tests cover:**
  - **Server:** field whitelisting (unknown fields, bad `lang`/`variant`/`fresh`, unknown E5 tags); injected `prompt`/`system` text never reaches the model; 413 over 2 KB with and without `content-length`; 400 for bad JSON, arrays and `null`; 405 on GET; 503 with no key (and no model call); the exact Groq request (model, `stream`, `reasoning_effort`, `include_reasoning`, token caps, temperature); stream conversion with 5-byte chunks splitting events and the ₹ character, reasoning deltas dropped, `[DONE]` last; fallback to 20b on 429 and on an empty first answer; 502 when all models fail; a mid-stream error event, not cached; `GROQ_MODEL` override; cache hit (one event, no model call), keys by language, length and E5, `fresh` skips and overwrites; untagged drafts not cached; the Redraft cap per visitor; the prompt's content; `/api/health` never exposes the key.
  - **Browser text:** preamble, markdown and quote stripping; every tag shape; tags not in the case file dropped; tags moved inside the full stop (including `।`); non-breaking hyphens; the scripted statement's conditions (chat, no chat, attach) in both languages; the typewriter never cutting a tag; word counts.
  - **Streaming client:** events split across 4-byte chunks; error status, error event and a missing `[DONE]` all reject; caller abort.
  - **End to end (both sizes):** the full journey from lock screen to the Holds tab with no console errors and no horizontal scroll at each step; the fallback path with `/api/draft` mocked to 503 (toast, scripted text, then Hindi with the Mukta font loaded); a real image picked and tagged as E5; dark mode luminance; the rail's "not connected" status and Scripted toggle; no "Razorpay" text anywhere inside the phone, and the disclaimers present.
- **Bug the tests caught:** `wordCount` counted a full stop left alone after a tag as a word ("UPI [E1][E2]." → 4). It now counts only tokens with a letter or digit, which also handles a lone `।`.
- **How it was verified:** `npm test` → 33/33 pass. `npm run test:e2e` → 12/12 pass, twice in a row (about 20 s). The local happy path drafts live through the real model.
- **Real versus simulated:** The unit tests mock Groq. The end-to-end happy path uses the real model locally (and against production in M11); the fallback test mocks a 503 on purpose.

## M8 · Polish

- **When / goal:** 5 Oct 2026. Find real issues, then fix them: dates, Hindi, dark-mode contrast, tap targets, plain copy.
- **What I asked:** List real issues, then fix them.
- **What Claude did (audit first, then fixes):**
  - **Dates.** Added `tests/unit/dates.test.js`, which scans `case-data.js`, `screens.js` and `index.html` for every weekday-and-date pair and checks it against the real calendar (2026; January → 2027). It also checks the story's intervals: respond in 7 days, decision 15 days after filing, escalation 15 days later, day 75 and day 90 from the hold, 11 days on hold. All 19 distinct dates were correct.
  - **Stale dates (found by reading the flow, now fixed).** Home's "Next settlement · Tue 6 Oct" didn't move when time advanced; it now follows the story (Tue 6 → Wed 7 → Sat 10 → Sat 17 Oct), and after release the chip reads "Includes ₹1,800 released from the hold". Hold detail kept saying "We file it by Mon 12 Oct" after filing and release; its banner now follows the stage.
  - **Contrast.** A script read the tokens from `styles.css`, blended the soft tints over their real backgrounds, and computed WCAG ratios for every text pairing in both themes. Everything passed AA except: (1) dark-mode white button text on `--primary`, 4.44:1, fixed by moving dark `--primary` from 55% to 53% lightness (4.75:1), the only deliberate change to a Blade value; (2) white on the solid status fills (alert icons, "NEW" tag, tab count, success check, timeline ticks), which dropped to 2.95–4.11:1 in dark mode. New `--hold-solid`, `--due-solid` and `--ok-solid` tokens stay the same in both themes, so text on them is ≥ 5.4:1 and icons ≥ 4.2:1. The concept strip went from 62% to 72% opacity.
  - **Tap targets.** A sweep of every button on every screen at 360 px found the segmented toggles (EN/हिंदी, Live AI/Scripted) at 34 px tall (now 40) and the inline proof tags at 25 px wide (now a 41 × 40 px hit area through a pseudo-element, without making the chips bulky in the text).
  - **Hindi and IDs.** Order numbers like "KK-2417" no longer break at the hyphen in the statement.
  - **Screen readers.** The push-banner layer is now a polite live region.
- **Decisions and trade-offs:** The dark `--primary` change is two lightness points and was the only deliberate change to a Blade token, made because the brief asks for contrast that holds in dark mode.
- **How it was verified:** `npm test` → 35/35 (with the date tests); `npm run test:e2e` → 12/12; re-ran the contrast script (no text pairing below 4.5:1 in use) and the tap-target sweep (every control ≥ 40 px); checked visually at 821×700 dark (narrowest desktop layout) and checked Home and Hold detail after release.
- **Real versus simulated:** No change.

## M9 · GitHub

- **When / goal:** 5 Oct 2026. The code in a repository under the owner's account.
- **What I asked:** Ask for visibility, then `gh repo create`.
- **What Claude did:** Checked that the name was free, then ran `gh repo create hold-rescue --private --source . --remote origin --push`. The owner chose **private**.
- **Decisions and trade-offs:** Before the first push, Claude checked the history for secrets. The brief's literal check (`git log -p | grep -i gsk_`) always matches `docs/brief.md` itself, which quotes that command, and a fake value in a unit test. So Claude used two stricter checks: key-shaped strings (`gsk_` plus 20 or more letters and digits), and the actual key value, read from `.env.local` through a file descriptor so it was never printed. Both found 0 in history and in tracked files; `.env.local` was never committed.
- **How it was verified:** `gh repo view` → `PRIVATE`, default branch `main`; `git status -sb` → `main...origin/main`.
- **Real versus simulated:** Real.

## M10 · Vercel

- **When / goal:** 5 Oct 2026. A public URL that opens on any phone with no login.
- **What I asked:** With approval: link a new project, add the key without displaying it, connect GitHub, deploy to production.
- **What Claude did:** `npx vercel link --yes --project hold-rescue` (framework "Other"; this also connected the GitHub repo); `grep '^GROQ_API_KEY=' .env.local | cut -d= -f2- | tr -d '\r\n' | npx vercel env add GROQ_API_KEY production` and the same for `preview` (both stored as hidden Secrets); `npx vercel --prod`.
- **Decisions and trade-offs:** `vercel link` rewrote `.env.local` to add a `VERCEL_OIDC_TOKEN`. Claude checked straight away, by variable names only, that `GROQ_API_KEY` was still there and the file still git-ignored. `.vercelignore` keeps `.env*`, tests, scripts and docs out of every upload.
- **How it was verified:** `vercel env ls` → `GROQ_API_KEY` as a hidden Secret in Production and Preview.
- **Real versus simulated:** Real.

## M11 · Verify production

- **When / goal:** 5 Oct 2026. Prove the live site works for a judge on a phone.
- **What Claude did and found (all against https://hold-rescue.vercel.app, logged out):**
  - The page returns 200 with no login wall. The per-deployment URL returns 302 to Vercel login, so previews stay protected and production is open, as the brief requires.
  - `GET /api/health` → `{"ok":true,"ai":true,"model":"gpt-oss-120b"}`.
  - `GET /api/draft` → 405; bad JSON → 400; a 3 KB body → 413.
  - `/.env.local`, `/.env`, `/tests/…`, `/scripts/…`, `/docs/brief.md` → 404.
  - Real streamed drafts: English first chunk 677 ms, done 1.1 s; Hindi 692 ms, done 1.3 s; 6 tags in plan order; says plainly it is an exchange dispute, not fraud.
  - `BASE_URL=https://hold-rescue.vercel.app npm run test:e2e` → **12/12 passed** at 390×844 and 1440×900, including the full journey with the live model.
  - In the in-app browser at 390 px: rail "Live: gpt-oss-120b…", statement "Drafted live by gpt-oss-120b · open model" with 6 proof chips.
- **Real versus simulated:** Real.

## M12 · Finish

- **When / goal:** 5 Oct 2026. Hand over.
- **What Claude did:** Put the live URL in `README.md`, completed this log, committed and pushed to `main`; the push deploys automatically through the GitHub connection.

## M5b · Follow-up agent (addendum)

- **When / goal:** 6 Oct 2026. The merchant lost money because nobody on a three-person team had time to follow up, not because they were confused. Big merchants get a human agent who chases the case for weeks. The follow-up agent gives every small merchant one, in software.
- **What I asked:** The addendum in full: a rules engine, four kinds of agent work (`officer_reply`, `call_brief`, `escalation`, `release_request`), two demo scenarios ("Responds" and "Goes quiet"), the agent card, log and "What the agent can do" sheet, new states on Home, Holds and the tab bar, AI drafting with fallbacks in English and Hindi, tests, and copy fixes.
- **The design choice: rules decide when, AI decides what to say, the merchant decides whether to send.**
  - **Timing is plain code** (`agent.js`), because these are legal deadlines: filing within 7 days of the response, the officer's 15 days, the District Grievance Officer's 15 more, Day 75 and Day 90 from the hold. A deadline must be exact, the same every time, and testable. A model can't promise either, and a missed or invented date costs the merchant real money. The engine is a pure function, `case + date → deadlines, proposals, watch list, notices`, with 18 unit tests that walk both scenarios date by date.
  - **AI only words the message.** Each agent kind gets a server-built sentence plan (the same approach that made the statement reliable in M4). The scenario facts (dates, references, the officer's request) are held on the server. Each kind may cite only the proofs its plan allows; any other tag is dropped. A draft that cites nothing, or a call brief that breaks its four-line shape, is replaced by the standard draft, with a toast saying why.
  - **The merchant approves every send.** Each outgoing message is a draft with **Approve and send**, **Edit** and **Not now**. "Send without asking" is shown, locked off. Nothing changes state without a tap, and every step is in "What your agent did": agent, you, officer and portal, newest first. This is about trust: a merchant will let software speak to the police for them only if they see every word first, and an officer can trust it only if every claim links to its proof.
- **Decisions and trade-offs:**
  - An unknown `kind` is refused with 400; other unknown fields are still dropped, as before. The browser never sends free text.
  - The call brief's questions are fixed by the rules; AI writes only the answers and the tip.
  - **No-chat versions of every template and plan.** If the merchant continued without the customer's chat, the reply says "I will share the customer's messages as soon as I can" instead of claiming they are attached.
  - **"Not now"** keeps the proposal (the badge and tab count still show it). It comes back with a reminder banner when time next moves. When the hold is lifted, anything still waiting is dropped from the proposals and the log says what happened.
  - Switching scenario after Submit restarts the post-submit story with the other officer. Restart keeps the scenario choice, like the AI mode.
  - The tracker's timeline now comes from the same engine, replacing the fixed stages, so the timeline, the watch list and the proposals can never disagree. "Responds" moves the call booking from Fri 9 Oct to Mon 12 Oct (the officer first asks for proof on Fri 9 Oct), and the call brief replaces the old "Before the call" checklist.
  - **Hindi fallbacks are faithful translations of the English templates, with IDs, ₹ amounts and tags unchanged. Jai: please review them** (`AGENT_SCRIPTED` in `case-data.js`), along with the call brief's Hindi labels in `CALL_BRIEF.hi`.
- **What testing against the real model changed:**
  - First pass: the model put tags on sentences meant to have none ("Thank you for your message [E1]"), copied the plan's second-person wording ("you have not been told…") and, in Hindi, used "जारी" for lifting the hold, which can also mean *continue*. Fixes: plan lines written as the first-person sentences they should become, an explicit "(no tag)" rule, a per-kind list of allowed proofs, and exact Hindi phrases ("रोक हटाई जाए", "राष्ट्रीय शिकायत निवारण पोर्टल").
  - The call brief's third answer once said "the exchange request was declined", which gets the story wrong. Now each answer's content is given and the model only rewords it.
  - A Hindi release request once read "the hold was placed by me". It now says plainly that police asked for the hold.
  - Final live run, all four kinds in both languages: every draft cites exactly the planned proofs, nothing banned appears, English is 56–81 words (the call brief has its own shape), and each draft returns in 0.8–2.2 s.
- **Copy fixes (Part C):** "police complaint" is now "cyber-fraud report" everywhere. The lock-screen alert reads "₹1,800 on hold: a cyber-fraud report names this payment". Hold detail explains the payment was reported on the national portal (1930), adds "Reported on" and "Hold requested by", and renames the reference to "Complaint acknowledgement no.". The "without an FIR" line became "even without registering a case", and "accuse your customer" became "blame your customer". A unit test and an end-to-end sweep of every screen check that "fake", "frozen", "FIR", "accused" and "police complaint" never appear. The model is told the same in its system prompt.
- **How it was verified:**
  - **Unit tests: 64/64.** These include the engine's deadlines, both scenarios, no duplicates, approve, Not now and reminders, release clearing proposals, purity, the log and the timeline; the API's `kind` whitelist (400), cache keys by `kind`, and scenario facts coming only from the server; the agent templates; the call brief parser; the banned words; and every new date.
  - **End to end: 22/22, twice.** Both scenarios run start to finish at 390×844 and 1440×900 against the live model. Each size drives one scenario from the rail's Advance and the other from the tracker's demo button. The suite also covers fallback drafts with `/api/draft` at 503, Not now and its reminder, "Action ready" on Home with the "Reply ready" badge and the tab count, no console errors, and no horizontal scroll.
  - **In the in-app browser:** "Goes quiet" produces exactly Thu 22 Oct (escalation), Fri 6 Nov ("Still waiting. Watching Day 75 (Sat 19 Dec) and Day 90 (Sun 3 Jan 2027)."), Sun 3 Jan 2027 (release request) and Tue 5 Jan 2027 (92 days on hold). Approving the escalation sets the District Grievance Officer's date to Fri 6 Nov.
- **New metrics** (added to the rail's "What we'd measure"): share of officer requests answered within 24 hours; escalations sent within 1 day of the deadline; share of agent drafts approved without edits (the log already records "You edited and approved…").
- **Real versus simulated:** The deadline maths and AI drafting are real. Sending is simulated: the agent never contacts anyone, and every "Sent to…" is a demo of what would be filed on the grievance portal. The officer's request, the call booking and the release are scripted scenario steps.

---

## AI in the product

**Which model, and why an open one.** The statement is drafted by **gpt-oss-120b**, OpenAI's open-weight model (Apache 2.0), served free by Groq, with **gpt-oss-20b** as the fallback. An open model means the merchant's dispute isn't tied to one closed vendor, a payment company could run the same weights on its own servers, and the prototype costs nothing to run. Claude confirmed both model IDs against Groq's live model list before building on them (M1). `GROQ_MODEL` can override the first choice.

**How the prompt is restricted to the case file.**
- The browser can send only `{ lang, variant, fresh, e5 }`. The server whitelists each field (unknown values fall back to safe defaults; an unknown E5 label becomes "no E5"), drops everything else, and refuses bodies over 2 KB before parsing them.
- The whole prompt is built on the server from `case-data.js`, the same module the screens render from, so the facts the merchant sees are exactly the facts the model is given. No free text from the browser ever reaches the model; a unit test injects `prompt` and `system` fields and checks they never appear in the request to Groq.
- The prompt is a **sentence plan**: what each sentence covers and which proof it cites. It leads with the OTP-confirmed delivery and the customer's own exchange request, then states plainly what this is. An uploaded screenshot is described only as "attached, contents not read", because the app never reads it.
- The complainant's identity is not in the data at all, so it can't be leaked.

**How made-up facts and accusations are prevented.**
- The system prompt forbids inventing facts, names, legal sections or promises, and forbids accusing the customer of fraud or any crime.
- Every `[E1]`–`[E5]` tag in the output is checked against the evidence actually in the case file; tags for anything else are removed (tested with an invented `[E9]`). Tag shapes the model improvises (`[E1, E2]`, `[E1–E3]`, `【E1】`, `(E1)`) are normalised so every claim links to its proof.
- Each tag is a tappable chip that shows the merchant the underlying evidence, so the merchant checks the AI's claims before signing a declaration that the facts are true.
- A finished draft that cites no proof, or is under 20 words, is not shown. The standard draft replaces it, with a note saying why. The server never caches such a draft.
- The merchant can edit the statement; tags they type are checked the same way, and the source chip changes to "Edited by you".

**What happens on failure.** If the model sends no text within 30 s, takes more than 90 s, is rate-limited, misconfigured (no key) or down, the browser shows the pre-written standard statement with a quick typewriter effect and a toast: "The open model did not answer, so this is the standard draft." On the server, a model that errors or returns nothing hands over to the next model within one shared 28 s budget, before anything is streamed. Redraft, which skips the cache, is capped per visitor (6 a minute) and per instance (30 a minute) so a public link can't use up the free quota. The presenter can also switch to **Scripted** for a demo that is identical every time and makes no AI calls.

**The follow-up agent uses the same guardrails**, with one rule on top: rules decide *when* (every deadline is plain, tested date arithmetic in `agent.js`), AI decides only *what to say*, and the merchant decides *whether to send*. The browser can ask only for one of four fixed kinds of message. Each kind's facts, dates and the officer's request are held on the server; each kind may cite only the proofs its plan allows; and no message counts as sent until the merchant taps **Approve and send**. If the model fails, each message falls back to its standard draft, with the same toast as the statement.
