# Hold Rescue

**A police complaint freezes ₹1,800 of a small merchant's money. Today they write it off. Here they answer it from their phone in under two minutes.**

A concept prototype for the Razorpay x ISB AI x PM Build Challenge, Track 1 ("Razorpay in Your Pocket"), by Jai Khurana.

> Big merchants get a human agent for this. Hold Rescue gives every small merchant the same help, in software.

**Live prototype: https://hold-rescue.vercel.app** · opens on any phone, no login. On a laptop it shows a phone frame with the presenter controls beside it; on a phone, tap "Demo controls".

Fictional merchant, customer and police data. Styled with Razorpay's open-source [Blade](https://github.com/razorpay/blade) design tokens (MIT); **not a Razorpay product**.

## What it does

When a fake cyber-crime complaint (1930 / NCRP) freezes a small payment, nobody guides a small merchant, so they write the money off. Hold Rescue turns the alert into a two-minute task on the phone:

1. **Alert** arrives as a push notification.
2. **Understand the hold**: what happened, the deadline, and what happens if you don't respond.
3. **Case file builds itself** from data the payment platform already has: payment, order, OTP-confirmed delivery, published exchange policy.
4. **Add the customer's chat** from the phone. It shows this is an exchange dispute, not fraud.
5. **Statement drafted by AI**: an open model (gpt-oss-120b on Groq) writes it only from the case file and tags every sentence with its proof. English or हिंदी.
6. **Review and submit** in one tap.
7. **Track to release**: grievance portal filing, a video call with the officer, and the 15-, 30- and 90-day deadlines, with reminders.

It promises a complete, on-time response, never an outcome. Police decide.

## Run it locally

Needs Node 20+ (22.9+ for `--env-file-if-exists`). No build step and no runtime dependencies.

```bash
npm install                      # dev-only: Playwright for the e2e tests
echo "GROQ_API_KEY=" > .env.local # then paste a free key from https://console.groq.com/keys
npm run dev                      # http://localhost:3000
```

Without a key the app still works: drafts use the scripted statement and say so.

## Tests

```bash
npm test                         # unit tests (node --test): API with mocked Groq, text cleaning, dates
npx playwright install chromium  # once
npm run test:e2e                 # Playwright at 390×844 and 1440×900
BASE_URL=https://your-url npm run test:e2e   # against a deployment
```

## Deploy (Vercel)

```bash
npx vercel link                  # framework "Other", no build command
grep '^GROQ_API_KEY=' .env.local | cut -d= -f2- | tr -d '\r\n' | npx vercel env add GROQ_API_KEY production
npx vercel --prod
```

`vercel.json` gives `api/draft.js` a 30 s limit. Optional: `GROQ_MODEL` overrides the first model tried.

## How it's built

Plain HTML, CSS and JavaScript (ES modules) plus two Vercel Functions. No framework, no bundler.

| File | What it does |
|---|---|
| `index.html` | Presenter rail and the phone shell |
| `styles.css` | Blade colour tokens (light and dark), layout, components |
| `app.js` | State, navigation, drafting, timer, demo controls |
| `screens.js` | One render function per screen |
| `case-data.js` | Every fact, in one place: used by the screens **and** by the AI prompt |
| `statement.js` | Pure text functions: clean the model's output, scripted statements |
| `draft-client.js` | Streams `/api/draft` in the browser, with timeouts |
| `api/draft.js` | `POST`: builds the prompt from `case-data.js`, streams from Groq |
| `api/health.js` | `GET`: `{ ok, ai, model }` |
| `scripts/dev-server.js` | Local server that runs `api/*.js` like Vercel does |

## How the AI is kept on a leash

- The browser can send only `{ lang, variant, fresh, e5 }`. The server whitelists each field, refuses bodies over 2 KB, and builds the whole prompt from the fixed facts in `case-data.js`. No free text from the browser ever reaches the model.
- The prompt is a sentence plan: what each sentence says and which proof it cites. It never accuses the customer and never names whoever complained.
- Every tag in the output is checked against the case file. A draft that cites no proof is replaced by the standard draft, with a note saying why.
- If the model is slow (no first text in 30 s), rate-limited, misconfigured or down, the scripted statement appears and says so.
- Redraft skips the cache, so it is capped per visitor to protect the free quota.

How AI was used to build this: see [BUILD_LOG.md](BUILD_LOG.md). The brief it started from: [docs/brief.md](docs/brief.md).
