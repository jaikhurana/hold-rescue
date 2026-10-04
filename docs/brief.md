# Build and ship "Hold Rescue" from scratch

You are my senior full-stack engineer and product-minded designer for the **Razorpay x ISB AI x PM Build Challenge, Track 1 ("Razorpay in Your Pocket")**. Track 1 asks for a focused mobile experience that helps an Indian SME merchant finish one important task end to end, ideally in under two minutes. Submission deadline: **13 Oct 2026, 11:59 PM IST**.

**Build everything from scratch in this session, including the setup.** The research and product decisions are done (summarised below). The setup, the code and the deployment are yours to do; I'll only do the steps that need me personally (approving installs, pasting my API key into a file, approving logins in my browser).

**Outcome I need:**
1. A working prototype on **Vercel** that anyone can open on a phone with no login.
2. The code in a new **GitHub** repository under my account.
3. A **BUILD_LOG.md** documenting how AI was used to build it (the challenge requires an "AI build log").

---

## 0. Setup (do this for me first)

Work through these in order, explaining each in one line before you run it.

1. **Project folder.** Create a new folder `hold-rescue` inside the current directory (unless I name another place) and do all work inside it. Copy this brief into it as `docs/brief.md`, so the repo shows the brief the build started from.
2. **Tools.** Check `node -v` (need 20+), `npm -v`, `git --version` and `gh --version`. If any are missing, tell me what you'll install and the exact command, and install after my OK:
   - macOS: Homebrew, e.g. `brew install node git gh`. If Homebrew itself is missing, give me the one-line installer from brew.sh to run and wait.
   - Windows: `winget install OpenJS.NodeJS.LTS Git.Git GitHub.cli`
   - Linux: the distro's package manager.
   - Vercel CLI: use `npx vercel`; no global install needed.
3. **Git identity.** If `git config user.name` or `user.email` is empty, ask me what to use and set it globally.
4. **Secret file.** Create `.gitignore` first (`.env*`, `node_modules`, `.vercel`, `test-results`, `playwright-report`, `.DS_Store`). Then create `.env.local` containing exactly `GROQ_API_KEY=`. Open it in my default editor (`open -t .env.local` on macOS, `notepad .env.local` on Windows, `xdg-open .env.local` on Linux).
   - Tell me: "Create a free key at https://console.groq.com/keys, paste it right after `GROQ_API_KEY=`, save, and reply *done*."
   - **Never ask me to paste the key into the chat, and never read or print the file's contents.** Check it only with a command that reports set or missing, e.g. `grep -q '^GROQ_API_KEY=..*' .env.local && echo set || echo missing`.
5. **GitHub login.** Run `gh auth status`. If I'm not logged in, run `gh auth login --hostname github.com --git-protocol https --web` and show me the one-time code and URL it prints so I can approve it in my browser.
   - If it can't finish inside your shell, ask me to type `! gh auth login --hostname github.com --git-protocol https --web` in this session (the `!` prefix runs a command directly), or run it in another terminal.
   - Afterwards run `gh auth setup-git` so `git push` works.
6. **Vercel login.** Run `npx vercel whoami`. If I'm not logged in, run `npx vercel login` the same way (or ask me to run `! npx vercel login`) and wait until `whoami` shows my account.
7. **Report.** One short summary: tools and versions, logins OK, key set (yes or no only). Then move on to the plan.

## 1. How to work with me

- **Plan after setup.** Once setup is done, read this whole brief and give me a plan: milestones, file structure, commands you'll run, and anything you need from me. Wait for my OK before writing app code.
- **Build in milestones** (section 11). At the end of each one, run it, check it in a browser, commit, and give me a 3–5 line update with what to look at.
- **Ask before anything that touches my accounts or can't be undone:** creating the GitHub repo (and its visibility), creating or linking the Vercel project, the first production deploy, deleting files.
- **Secrets:** my Groq API key lives only in `.env.local`. Never print, echo, log, paste into chat, or commit it, and never `cat` that file. `.env*` is in `.gitignore` before the first commit.
- **Verify, don't assume.** Run things and read the output. If something fails, diagnose before retrying. If you're blocked on something only I can do (a login, a browser step), give me the exact command or click path and wait.
- **Keep scope tight.** Build exactly what's specified. If you think something else matters for winning, suggest it in one line; don't build it unless I agree.
- **Keep BUILD_LOG.md updated as you go**, not at the end (format in section 13).

---

## 2. The product (why this exists)

**Problem, from a real merchant interview.** A small online clothing seller with a tiny team sells orders averaging about ₹1,800. When a customer dislikes the product or the size is wrong, they ask for an exchange. The store's published policy says the customer pays the return courier. Some customers refuse, then file a **fake cyber-crime complaint** (1930 helpline / National Cybercrime Reporting Portal). The complaint reaches the payment gateway, which **holds the payment amount**. This happened 3 times in 6 months. For large amounts the gateway assigns a person to guide the merchant. For small amounts nobody does, the team has no time to follow up, so **the merchant writes the money off**.

**Rules that shape the product** (MHA SOP of 2 Jan 2026 for NCRP/CFCFRMS holds, enforced by a Supreme Court order of 9 Feb 2026; the national Grievance Redressal Module has been live since April 2026):
- Holds are limited to the disputed amount. The payment company may share the police station's contact, **never the complainant's identity**.
- The payment company files the account holder's grievance on the national grievance portal **within 7 days**. The investigating officer decides **within 15 days**, preferably by **video call**. If not, it escalates automatically to the **District Grievance Officer** (15 more days).
- For amounts **under ₹50,000**, police can hand the money to the complainant **without an FIR** if the account holder doesn't respond.
- A contested hold lapses after **90 days** unless police get a legal order to extend it.

**The one task:** a small merchant answers a police-complaint hold **from their phone in under two minutes**, using evidence the payment platform already has, then tracks it to release.

**Key insight:** these complaints are exchange disputes, not fraud. The case file leads with OTP-confirmed delivery, the published exchange policy, and the customer's own chat asking for an exchange.

**Promise speed and completeness, never an outcome.** Police decide.

**Pitch line:** "Big merchants get a human agent for this. Hold Rescue gives every small merchant the same help, in software."

**Why mobile:** the alert arrives as a push notification, the key evidence (the customer's chat) is a screenshot on the merchant's phone, and the merchant is rarely at a laptop.

---

## 3. Hard constraints

1. **Stack:** plain HTML, CSS and JavaScript (ES modules) plus Vercel Functions in the Node runtime using the Web handler signature (`export async function POST(request)`, `export function GET()`), with `"type": "module"` in package.json. No framework, no bundler, no build step, no runtime npm dependencies. Dev-only dependencies for tests are fine. *Why: judges should be able to read it, and nothing can break at build time.*
2. **Look:** the visual language of the Razorpay merchant app, built from Razorpay's **open-source Blade design tokens** (github.com/razorpay/blade, MIT licence; values in section 5). **Never** use the Razorpay logo, wordmark, or the name "Razorpay" anywhere inside the phone UI. The app's notification name is "Payments". Show a "Concept · fictional data" strip inside the phone, and "Not a Razorpay product" in the presenter rail. *Why: it must not pass as an official Razorpay screen.*
3. **Data:** fictional only (section 7). Never show who complained.
4. **AI endpoint safety:** the browser sends only `{ lang, variant, fresh, e5 }` (section 8). The server whitelists every field, caps the body at 2 KB and builds the prompt from fixed facts. No free text from the browser ever reaches the model. *Why: it's a public URL on my free quota and must only ever draft this one statement.*
5. **Never dead-ends:** if the model is slow (no first token in 30 s), rate-limited, misconfigured or down, the page shows a scripted draft and says so in a toast.
6. **Responsive and accessible:** works at phone widths of 360–430 px and on desktop (section 5). Light and dark themes via `prefers-color-scheme`. Respects `prefers-reduced-motion`. No horizontal scroll. Visible focus states. Real `<button>` elements. Tap targets at least 40 px.

---

## 4. Suggested structure (adjust if you have a better reason)

```
index.html          markup for the presenter rail, phone frame and all screens
styles.css          tokens, layout, components
app.js              state, navigation, rendering, drafting client, demo controls
case-data.js        ES module: merchant, evidence (E1–E5), templates, timeline. Imported by app.js AND by api/draft.js, so the facts live in one place
api/draft.js        POST: builds the prompt, calls Groq, streams back
api/health.js       GET: { ok, ai, model }
vercel.json         maxDuration 30 for api/draft.js
package.json        "type": "module", test scripts, dev deps only
tests/              unit tests (node --test) and Playwright e2e
README.md, BUILD_LOG.md
```

---

## 5. Design system

### Colour tokens (CSS custom properties)

| Token | Light | Dark |
|---|---|---|
| `--ground` (page behind the phone) | `#E9EDF3` | `#06080B` |
| `--bg` (app background) | `#F5F6F8` | `hsl(210 5% 8%)` |
| `--surface` (cards, bars) | `#FFFFFF` | `hsl(210 6% 13%)` |
| `--surface-2` | `#EFF1F4` | `hsl(210 5% 17%)` |
| `--ink` | `#1B2126` | `#F1F3F4` |
| `--ink-2` | `#2D353A` | `hsl(210 3% 80%)` |
| `--muted` | `#5F6B73` | `hsl(210 3% 64%)` |
| `--line` | `#DEE2E5` | `hsl(216 4% 22%)` |
| `--line-2` | `#C6CDD2` | `hsl(210 4% 32%)` |
| `--primary` (Blade azure 500) | `hsl(218 89% 51%)` | `hsl(218 89% 55%)` |
| `--primary-strong` | `hsl(218 87% 43%)` | `hsl(218 89% 61%)` |
| `--on-primary` | `#FFFFFF` | `#FFFFFF` |
| `--primary-text` | `hsl(218 87% 43%)` | `hsl(217 100% 74%)` |
| `--primary-soft` | `hsl(218 89% 51% / .09)` | `hsl(218 89% 55% / .22)` |
| `--ok` (Blade emerald) | `hsl(150 100% 28%)` | `hsl(150 48% 42%)` |
| `--ok-text` | `hsl(150 100% 22%)` | `hsl(150 40% 64%)` |
| `--ok-soft` | `hsl(150 100% 28% / .10)` | `hsl(150 60% 40% / .22)` |
| `--hold` (Blade crimson) | `hsl(4 85% 44%)` | `hsl(5 73% 55%)` |
| `--hold-text` | `hsl(4 85% 38%)` | `hsl(5 77% 76%)` |
| `--hold-soft` | `hsl(4 85% 44% / .09)` | `hsl(5 76% 55% / .20)` |
| `--due` (Blade cider) | `hsl(25 100% 44%)` | `hsl(23 92% 53%)` |
| `--due-text` | `hsl(25 100% 32%)` | `hsl(24 100% 72%)` |
| `--due-soft` | `hsl(25 100% 44% / .11)` | `hsl(25 100% 50% / .18)` |
| `--navy` / `--navy-2` (hero gradient) | `hsl(218 93% 10%)` / `hsl(218 90% 20%)` | `hsl(218 72% 11%)` / `hsl(218 80% 19%)` |

### Type
- Text: **Inter** (400–700). Headings and money amounts: **TASA Orbiter** (400–800). Both from Google Fonts, each in its own `<link>`. Add **Mukta** (400–600) as the Devanagari fallback in the body font stack. Code-like IDs (payment ID, UTR, AWB): `ui-monospace, "SF Mono", Menlo, "Roboto Mono", monospace`.
- Base 14px / 1.5. App bar titles 16px semibold. Big amounts 34px TASA Orbiter bold with tabular numbers.

### Components
- Cards: white surface, 1px `--line` border, 12px radius, 16px padding.
- Buttons: primary is `--primary` fill, white text, 48px high, 10px radius; secondary is an outlined primary; text buttons in `--primary-text`.
- Badges: pill-shaped, a soft background with matching text colour (negative, notice, positive, info).
- Banners: soft-tinted rows with an icon (notice, positive, info).
- Line icons: inline SVG, 1.8 stroke, round caps. No emoji, no icon fonts.

### Layout
- **Desktop (wider than 820px):** two columns centred on `--ground`. Left is the presenter rail (300–360px, section 9). Right is a phone frame: 414px wide, height `min(868px, 100dvh − 56px)`, 12px dark bezel, 60px outer and 48px inner radius. Inside it: a fake status bar showing "10:12" with a dynamic island, signal and battery; a centred "CONCEPT · FICTIONAL DATA" strip below it in tiny tracked caps; and a home indicator at the bottom.
- **Phone (820px or narrower):** no frame and no fake status bar. The app fills the screen. The strip sits at the top with a "Demo controls" pill button on the right that opens the presenter rail as a bottom sheet.
- Each screen is a full-height column: app bar, scrolling body, then a sticky footer for the main action. Status-bar text is white on the lock screen and the navy home hero, dark elsewhere.
- Subtle screen transitions (slide 28px plus fade, 260ms). The case-file items stagger in once. The success check pops. Nothing else animates.

---

## 6. Screens and copy (build all of these)

Use this copy as written unless it doesn't fit; keep it plain and short.

**1. Lock screen.** Blue-navy gradient wallpaper (fixed look in both themes). "Monday, 5 October", a large "10:12". Two notifications at the bottom in frosted cards, app name "Payments" with a small blue "₹" glyph:
- Tappable: "₹1,800 is on hold after a police complaint" / "Order KK-2417. Respond by Mon 12 Oct to get it back. Takes about 2 minutes." · now
- Dimmed: "Settlement of ₹21,940 sent to your bank" · Sun

Hint: "Tap the alert to open it". Tapping opens the Hold detail, with Home behind it in the back stack.

**2. Home.** A navy gradient hero runs under the status bar. It shows: an avatar "KK"; "Kesar Kurtas"; a green dot with "Live mode · Jaipur"; a bell; "Next settlement · Tue 6 Oct"; **₹23,480**; and a chip with a red dot reading "₹1,800 held back from this settlement".

Below the hero:
- Four quick actions: Payment links, QR codes, Refunds, and **Holds** with a "NEW" tag. Only Holds works; the others show the toast "Not part of this prototype."
- An alert card. Hold state: red, lock icon, "ACTION NEEDED · 7 DAYS LEFT" / "₹1,800 on hold after a police complaint" / "Order KK-2417 · respond by Mon 12 Oct". After submit: amber, "UNDER REVIEW" / "Your response on ₹1,800 is filed". After release: green, "HOLD LIFTED" / "₹1,800 is back in your settlement".
- "Today's payments" (₹4,940 · 3): KK-2484 UPI 9:48 AM ₹1,450; KK-2483 Card 9:12 AM ₹2,290; KK-2481 UPI 8:30 AM ₹1,200, each with a "Captured" badge.

Bottom tabs: Home, Payments, Holds (red count "1" until submitted), Account. Payments and Account show the toast.

**3. Holds tab.** Title "Holds". Intro: "Money held back from your settlements because police or a bank asked for it."
- A two-cell ledger: "Lost in 2026" ₹3,750 (red) and "Recovered" ₹0, which becomes ₹1,800 after release.
- "Active": a card for KK-2417 · police complaint, ₹1,800, Cyber Crime PS, Lucknow · held 5 Oct, with a status badge.
- "Earlier this year": KK-2093 · Jul 2026 and KK-1876 · Apr 2026, each "Not answered. Returned to the complainant.", −₹2,100 and −₹1,650, with a "Lost" badge. Note under them: "Both were small orders. No one on the team had time to follow up before the deadline."

Tapping the active hold opens Hold detail before submit, and the Tracker after.

**4. Hold detail ("Payment on hold").**
- Summary card: "AMOUNT ON HOLD", ₹1,800, an "On hold" badge, "Order KK-2417 · held from your settlement on 5 Oct".
- Notice banner with a clock icon: "Respond by Mon 12 Oct", "7 days left", and a thin progress bar.
- Card, "What happened": "A cyber-crime complaint filed with police in Lucknow names this payment. The law requires us to hold the amount until police decide. The money is safe with us."
- Same card, "If you don't respond": "For amounts under ₹50,000, police can hand the money to the person who complained, without an FIR. **That is how ₹3,750 went on two holds this year.**"
- Info banner: "**Delivered with OTP on 18 Sep** · No refund or return on record. If the customer asked for an exchange, that chat is your strongest proof."
- Facts card: Police station: Cyber Crime PS, Lucknow · Complaint ref.: 3120926••••0471 · Complaint filed: Sat 3 Oct 2026 · Who complained: Kept private by law.
- Footer: "Build my response · about 2 min". After submit, a positive banner replaces the deadline and the footer becomes "Track progress".

**5. Case file.**
- Navy "file cover" card styled like an Indian government file: "CASE FILE" plus a count chip ("4 of 5 ready"), then dashed form lines: FILE NO. KK-2417 · SUBJECT Hold of ₹1,800, police complaint · STATUS "Built from your account in 3 s", which becomes "Exchange dispute, not fraud" once E5 is added.
- Evidence cards E1–E4 (section 7), each with an ID chip, title, source line, content and a green check.
- E5 as a dashed amber "missing" card: "Customer's exchange request" / "Missing · probably on your phone" / "Add the chat where the customer asked for an exchange. It shows the officer this is an exchange dispute, not fraud." with an "Add from phone" button.
- Footer: "Add the customer's chat" plus a text button "Continue without it". Once E5 is added: "Draft my statement".

**6. "Add from your phone" bottom sheet.**
- Intro: "Screenshots taken after delivery on 18 Sep. One of them mentions this order."
- Three thumbnails:
  - (a) A mini chat screenshot (section 7), outlined in primary, badge "Mentions an exchange", caption "19 Sep · 10:32". Tapping shows the screenshot large with a scanning effect and "Reading the screenshot…" for about 1.5 s. Then: "WHAT IT SHOWS: **19 Sep, 10:04** · Customer asks to swap size M for L. **10:31** · Refuses the ₹120 return courier and says they'll complain." and "✓ Number ending 4417 matches order KK-2417", with the button "Add to case file".
  - (b) A product photo (shirt line icon), 18 Sep · 13:40. Toast: "That photo shows the product, not the conversation. Pick the chat."
  - (c) A payment screenshot (Paid ₹1,800 UPI), 14 Sep · 19:43. Toast: "That shows the payment, which is already in your file as E1."
- "Choose another screenshot" opens a real file picker (images only). After picking, show the image and ask "What does it show?" with chips: Exchange request / Delivery proof / Something else. That adds E5 with the chosen label.
- Fine print: "Prototype: these three screenshots are samples. You can also pick a real image."
- Adding E5 closes the sheet, shows the toast "Added to your case file" and clears any drafted statement.

**7. Your statement.** App bar with an EN / हिंदी toggle.
- A source chip: "Drafting live with gpt-oss-120b · open model" while streaming, then "Drafted live by gpt-oss-120b · open model". Fallback: "Standard draft from your case file". After edits: "Edited by you".
- A letter card:
  - Head: "To the Investigating Officer, Cyber Crime Police Station, Lucknow" and a mono line "Re: complaint 3120926••••0471 · ₹1,800 hold on order KK-2417".
  - Hindi head: "सेवा में, जाँच अधिकारी, साइबर क्राइम थाना, लखनऊ" and "विषय: शिकायत 3120926••••0471 · ऑर्डर KK-2417 पर ₹1,800 की रोक".
  - The statement text, with every [E1]–[E5] rendered as a small tappable chip. Tapping shows a toast like "E3 · Delivery: Delivered Fri 18 Sep, 1:15 PM · recipient confirmed with OTP".
  - Signature: "Arjun Mehta, Kesar Kurtas, Jaipur" (Hindi: "अर्जुन मेहता, केसर कुर्ताज़, जयपुर").
- Chips: Edit (becomes a textarea; "Done" saves), Shorter (toggle), Redraft (asks the model again, skipping the cache), and Stop while streaming.
- Guard line with a shield icon: "AI writes only from your case file. It won't add facts or accuse your customer. Tap a tag to see its proof."
- Footer: "Review and submit", disabled while drafting or editing.

**8. Review and submit.**
- Card with a 3-step route:
  1. "You send it from here" · Case file and statement, in one tap
  2. "Our grievance desk files it" · On the national cyber-crime grievance portal, within 7 days
  3. "The investigating officer decides" · Cyber Crime PS, Lucknow · within 15 days of filing
- Pack card: Case file "5 items"; Statement "English · 142 words" (live count); Video call contact "+91 98290 •••12".
- "Best time for a video call" chips: Weekday mornings (default), Weekday evenings, Any time.
- Declaration checkbox: "I confirm these facts are true. I understand that a false statement is an offence."
- Footer: "Submit response", enabled only when ticked. It shows a spinner and "Sending your case file…" for about 1.3 s. Fine print: "Prototype: nothing is actually sent."

**9. Response submitted.** A green check circle that pops in, "Response submitted", and "We file it on the national grievance portal and tell you the moment the officer replies. Nobody on your team needs to follow up."
- A time card: "ALERT TO SUBMITTED" with the measured time, e.g. **1:24**. Hide it if no time was measured.
- Facts card: Reference HR-2417-1005 · Submitted Mon 5 Oct 2026 · Filed on portal by Mon 12 Oct · Reminders On.
- Footer: "Track this hold".

**10. Tracker ("Hold · KK-2417").** Summary card with ₹1,800, the police station and a status badge (Under review, then Released). A vertical timeline with done (green check), now (amber ring) and next (grey) states:

| # | Item | Before filing | After "filed" (stage 1+) | After release (stage 3) |
|---|---|---|---|---|
| 1 | Hold placed | done · Mon 5 Oct · "₹1,800 held after a complaint at Cyber Crime PS, Lucknow." | same | same |
| 2 | You responded | done · Mon 5 Oct · "Case file and statement sent in 1 min 24 s." | same | same |
| 3 | Filed on the national grievance portal | now · By Mon 12 Oct · "We file it for you. Nothing for you to do." | done · Tue 6 Oct · "Reference GRM/2026/LKO/58213." | done |
| 4 | Officer decides | next · 15 days after filing · "Usually by video call, so you won't need to travel to Lucknow." | now · By Wed 21 Oct (stage 2: "Video call booked for Wed 14 Oct, 11:30 AM." plus a "Before the call" checklist: keep this case file open; join from a quiet place with your ID nearby; we'll remind you 30 minutes before) | done · Fri 16 Oct · "Hold released. No further action." |
| 5 | If no decision: District Grievance Officer | next · 15 days later | next · By Thu 5 Nov | faded |
| 6 | Day 75 check | next · Sat 19 Dec · "We remind you and confirm the status." | same | faded |
| 7 | Day 90: the hold must end | next · Sun 3 Jan 2027 · "A contested hold lapses unless police get a legal order to extend it." | same | faded |

Below the timeline: an info banner, "Reminders on · We alert you before each deadline, so nobody on your team has to keep track." Then a dashed "DEMO · Skip ahead to <next date>" button that does the same as "Advance time". After release, the footer shows "See the result".

**Advance time stages.** Each stage shows an in-app push banner that slides from the top and is tappable:
1. Tue 6 Oct: "Grievance filed" / "Your response on KK-2417 is on the national grievance portal. The officer has 15 days to decide." Opens the Tracker.
2. Fri 9 Oct: "Video call booked" / "Investigating officer, Cyber Crime PS Lucknow. Wed 14 Oct, 11:30 AM. Tap to prepare." Opens the Tracker.
3. Fri 16 Oct: "Hold lifted: ₹1,800 is yours" / "It will be added to your settlement on Sat 17 Oct." Opens Outcome.

**11. Outcome.** Green check, "Hold lifted", **₹1,800**, "Back in your settlement on Sat 17 Oct." Facts: Your time on it (measured, e.g. "1 min 24 s") · Days on hold 11 · Released on Fri 16 Oct 2026 · Lost earlier this year ₹3,750 on 2 holds. Footer: "Done", which goes to the Holds tab.

---

## 7. Case data (one module, used by both client and server)

**Merchant:** Arjun Mehta, Kesar Kurtas, an online clothing store in Jaipur. Hold of ₹1,800 placed 5 Oct 2026 after a complaint at Cyber Crime Police Station, Lucknow; complaint ref 3120926••••0471, filed Sat 3 Oct 2026.

**Evidence.** For each item, `title`, `src` and the display line are shown in the UI; `fact` goes into the prompt.

| ID | Title | Source | Shown | Fact for the model |
|---|---|---|---|---|
| E1 | Payment | From your payments | ₹1,800 by UPI · Mon 14 Sep, 7:42 PM · `pay_Q8xV2mK41sTzA · UTR 425716038842` | Payment of ₹1,800 by UPI on 14 Sep 2026 at 7:42 PM. Payment ID pay_Q8xV2mK41sTzA, UTR 425716038842. |
| E2 | Order and invoice | From your order notes | 1 cotton kurta set, size M · `Order KK-2417 · Invoice INV-2026-0917` | Order KK-2417: one cotton kurta set, size M. Invoice INV-2026-0917. |
| E3 | Delivery | From your shipping partner | Delivered Fri 18 Sep, 1:15 PM · recipient confirmed with OTP · `AWB 1489 2203 7716` | Delivered on 18 Sep 2026 at 1:15 PM; the recipient confirmed delivery with an OTP. AWB 1489 2203 7716. |
| E4 | Your exchange policy | From your store page, live since 2 Mar | Quote: "Size exchange free within 7 days of delivery. Customer pays the ₹120 return courier." | Exchange policy published on the store page since 2 Mar 2026: free size exchange within 7 days of delivery; the customer pays the ₹120 return courier. |
| E5 (sample chat) | Customer's exchange request | Chat screenshot from your phone | Sat 19 Sep: asked to swap size M for L, refused the ₹120 return courier, said they would complain. | Chat on 19 Sep 2026: the customer asked to exchange size M for size L, refused to pay the ₹120 return courier, and said they would file a complaint. |
| E5 (tagged upload) | the chosen label | Your screenshot, tagged by you | Added from your phone. | A screenshot from the merchant's phone, tagged by the merchant as "<label>". Its contents were not read, so do not describe them beyond saying it is attached. |

Allowed E5 labels: `Customer's exchange request`, `Delivery proof`, `Other proof`.

**Chat screenshot** (render in HTML/CSS as a generic chat app, not a copy of any real app). Header: "Customer (KK-2417)", +91 ••••• •4417. Date: "Sat, 19 Sep".
- Customer, 10:04: "Size M thoda tight hai, L chahiye. Exchange kar do please"
- Merchant, 10:20: "Ji ma'am, exchange ho jayega. Return courier ₹120 aapko dena hoga, website pe policy likhi hai"
- Customer, 10:31: "Courier ka paisa main kyun du? Main complaint kar dungi"

**Scripted fallback statements.** Used when AI is off or fails. Show them with a quick typewriter effect (about 2.3 s; instant with reduced motion). Sentences marked *chat* appear only when the sample chat is E5. *Attach* appears only when E5 is a tagged upload. *No-chat* appears when E5 is not the sample chat.

English, full:
1. I run Kesar Kurtas, an online clothing store in Jaipur.
2. On 14 Sep 2026 the customer paid ₹1,800 by UPI for order KK-2417, a cotton kurta set in size M [E1][E2].
3. It was delivered on 18 Sep, and the recipient confirmed delivery with an OTP [E3].
4. *(chat)* On 19 Sep the customer asked to exchange it for size L [E5].
5. Our published policy offers a free size exchange within 7 days, with the customer paying the ₹120 return courier [E4].
6. *(attach)* I have attached a screenshot of our conversation [E5].
7. *(chat)* The customer refused to pay this charge and said they would file a complaint [E5].
8. *(chat)* This is a dispute about an exchange, not a fraud: the product was ordered, paid for and delivered.
9. *(no-chat)* The product was ordered, paid for and delivered, and we offer exchanges under this policy, so this is not a fraud.
10. I request that the hold of ₹1,800 be released.
11. I am ready to exchange the product as per our policy and can join a video call at any time.

English, shorter. *Chat:* "Order KK-2417 (₹1,800, paid by UPI on 14 Sep) was delivered on 18 Sep with OTP confirmation [E1][E2][E3]. On 19 Sep the customer asked to exchange size M for L but refused the ₹120 return courier charge in our published policy [E4][E5]. This is an exchange dispute, not fraud. I request release of the ₹1,800 hold and am available for a video call." *No-chat:* "Order KK-2417 (₹1,800, paid by UPI on 14 Sep) was delivered on 18 Sep with OTP confirmation [E1][E2][E3]. Our published policy offers a free size exchange within 7 days [E4]. The product was ordered, paid for and delivered, so this is not a fraud. I request release of the ₹1,800 hold and am available for a video call." *Attach* adds: " A screenshot of our conversation is attached [E5]."

Hindi, full (same conditions, in order):
1. मैं जयपुर में केसर कुर्ताज़ नाम से कपड़ों की ऑनलाइन दुकान चलाता हूँ।
2. 14 सितंबर 2026 को ग्राहक ने ऑर्डर KK-2417 (कॉटन कुर्ता सेट, साइज़ M) के लिए UPI से ₹1,800 का भुगतान किया [E1][E2]।
3. ऑर्डर 18 सितंबर को डिलीवर हुआ और प्राप्तकर्ता ने OTP से इसकी पुष्टि की [E3]।
4. *(chat)* 19 सितंबर को ग्राहक ने इसे साइज़ L से बदलने को कहा [E5]।
5. हमारी प्रकाशित नीति में 7 दिन के भीतर साइज़ बदलना मुफ़्त है, केवल ₹120 वापसी कूरियर ग्राहक देता है [E4]।
6. *(attach)* हमारी बातचीत का स्क्रीनशॉट संलग्न है [E5]।
7. *(chat)* ग्राहक ने यह शुल्क देने से मना किया और शिकायत करने की बात कही [E5]।
8. *(chat)* यह एक्सचेंज को लेकर विवाद है, धोखाधड़ी नहीं: सामान ऑर्डर हुआ, भुगतान हुआ और डिलीवर हुआ।
9. *(no-chat)* सामान ऑर्डर हुआ, भुगतान हुआ और डिलीवर हुआ, और हम इस नीति के तहत बदलाव देते हैं, इसलिए यह धोखाधड़ी नहीं है।
10. मेरा अनुरोध है कि ₹1,800 की रोक हटाई जाए।
11. मैं नीति के अनुसार सामान बदलने को तैयार हूँ और किसी भी समय वीडियो कॉल पर जुड़ सकता हूँ।

Hindi, shorter. *Chat:* "ऑर्डर KK-2417 (₹1,800, 14 सितंबर को UPI से भुगतान) 18 सितंबर को OTP पुष्टि के साथ डिलीवर हुआ [E1][E2][E3]। 19 सितंबर को ग्राहक ने साइज़ M को L से बदलने को कहा, पर हमारी प्रकाशित नीति का ₹120 वापसी कूरियर शुल्क देने से मना किया [E4][E5]। यह एक्सचेंज विवाद है, धोखाधड़ी नहीं। कृपया ₹1,800 की रोक हटाएँ; मैं वीडियो कॉल के लिए उपलब्ध हूँ।" *No-chat:* "ऑर्डर KK-2417 (₹1,800, 14 सितंबर को UPI से भुगतान) 18 सितंबर को OTP पुष्टि के साथ डिलीवर हुआ [E1][E2][E3]। हमारी प्रकाशित नीति में 7 दिन के भीतर साइज़ बदलना मुफ़्त है [E4]। सामान ऑर्डर हुआ, भुगतान हुआ और डिलीवर हुआ, इसलिए यह धोखाधड़ी नहीं है। कृपया ₹1,800 की रोक हटाएँ; मैं वीडियो कॉल के लिए उपलब्ध हूँ।" *Attach* adds: " हमारी बातचीत का स्क्रीनशॉट संलग्न है [E5]।"

---

## 8. AI drafting

**Provider and model.** Groq's free, OpenAI-compatible API: `https://api.groq.com/openai/v1/chat/completions`, key in env var `GROQ_API_KEY`. Use **`openai/gpt-oss-120b`** (OpenAI's open-weight model, Apache 2.0) and fall back to **`openai/gpt-oss-20b`**. Groq shut down its Llama models for free and developer tiers on 16 Aug 2026. **Confirm current availability** with `GET https://api.groq.com/openai/v1/models` before relying on these IDs, and allow an optional `GROQ_MODEL` env override. The free tier for gpt-oss-120b (Oct 2026; verify) is 30 requests/min, 1,000/day, 8,000 tokens/min and 200,000 tokens/day; a draft is roughly 1,500 tokens.

**Browser → `POST /api/draft`.** The body is `{ lang: "en"|"hi", variant: ""|"shorter", fresh: boolean, e5: null | {kind:"chat"} | {kind:"tag", tag:<allowed label>} }`. The server:
- Whitelists and normalises each field; drops anything else.
- Rejects bodies over 2 KB (413), bad JSON (400) and GET (405).
- Returns 503 `{error:"api_key_missing"}` if there is no key.

**Prompt (built only on the server).**
- System: "You draft short, factual statements for small online merchants in India who are answering a police cyber-crime grievance about a held payment. You use only the facts you are given. You never invent facts, names, legal sections or promises. You never accuse the customer of fraud or any crime. You output only the statement text, with no introduction, heading, greeting, sign-off, markdown or quotation marks."
- User:
  - The task (draft the statement to the investigating officer asking for release).
  - Language: plain English, or simple everyday Hindi in Devanagari that keeps IDs, ₹ amounts and tags as written.
  - Voice and form: first person as the merchant (a man), calm and factual, one paragraph, 110–150 words (60–80 for Shorter), and only the listed facts.
  - Restrictions: don't accuse or name the customer.
  - What to say plainly: that it's an exchange and courier-charge dispute, not fraud (if E5 is the chat or tagged "Customer's exchange request"); otherwise that the product was ordered, paid for and delivered, so it isn't fraud.
  - Tags and ending: tag each sentence that relies on a fact with its ID, like [E3], using only the listed tags; end by asking for release and offering a video call; output only the statement.
  - Then "Facts:": the merchant line, the hold line, and the E1–E5 facts.

**Groq request:** `stream: true`, `reasoning_effort: "low"`, `include_reasoning: false`, `max_completion_tokens` 1000 (1400 for Hindi), `temperature` 0.3 (0.8 when `fresh`), with a 28 s timeout. On a non-OK status (429, 4xx, 5xx) try the next model. If all fail, return 502 `{error:"model_unavailable"}`.

**Server → browser:** server-sent events `data: {"response":"<piece>"}` … `data: [DONE]`, with headers `content-type: text/event-stream`, `cache-control: no-store` and `x-model-label: gpt-oss-120b` (the label of whichever model answered). Convert Groq's `choices[0].delta.content`. Drop reasoning deltas. Handle events split across network chunks.

**Cache:** in memory per warm instance, keyed by lang/variant/e5, kept 24 h. A repeat request returns one event with header `x-cache: hit`. `fresh` (Redraft) skips the cache and overwrites it.

**`GET /api/health`:** `{ ok: true, ai: <key is set>, model: "<label>" }`. The rail calls this on load to show whether the model is connected.

**Browser side:**
- Show "Drafting from your case file…" until the first piece arrives, then stream the text in.
- Clean the text: strip "Here is…:" preambles, quotes and `**`; normalise tags like `[E1, E2]` into `[E1][E2]`; drop tags for evidence that doesn't exist; remove the space left before punctuation.
- Abort the request if no first token arrives in 30 s, or after 90 s in total. On any failure or abort, show the scripted statement with the typewriter effect and the toast "The open model did not answer, so this is the standard draft."
- Switching language while drafting cancels the current draft.

---

## 9. Presenter rail and demo controls

The rail is on the left on desktop, and a bottom sheet behind "Demo controls" on phones. It contains:
- Eyebrow: "CONCEPT PROTOTYPE · TRACK 1". Title **Hold Rescue** (TASA Orbiter, about 42px). Pitch: "A police complaint freezes ₹1,800 of a small merchant's money. Today they write it off. Here they answer it from their phone in under two minutes."
- **Timer card:** "Alert to submitted", large m:ss, "Goal: under 2:00", and a bar that fills to 2:00 (amber if over). It starts the first time the Hold detail opens and stops when Submit is tapped. Its value is shown on the Submitted screen, in the Tracker and on Outcome.
- **Seven numbered steps** that jump to: 1 Alert arrives (lock), 2 Understand the hold, 3 Case file builds itself, 4 Add the customer's chat (case file with the sheet open), 5 Statement drafted by AI, 6 Review and submit, 7 Track to release. Jumping fills in whatever earlier steps would have produced: the sample chat as E5, the scripted statement if none exists, and the submitted state for step 7. Highlight the current step and mark earlier ones done.
- Buttons: **Restart** (resets everything to the lock screen) and **Advance time** (disabled until submitted; its label shows the next date, e.g. "Advance to Tue 6 Oct").
- **Drafting: Live AI | Scripted** toggle with a status line:
  - Live and connected: "Live: gpt-oss-120b, an open model running on Groq, drafts the statement. Free, no login."
  - Key missing: "Open model not connected yet: add GROQ_API_KEY under Vercel's Environment Variables, then redeploy. Until then, drafts use the scripted text."
  - Scripted: "Scripted: instant and the same every time. Best for recording."
- Three collapsible sections:
  - *Product decisions:* lead with delivery proof and the customer's exchange request (in our merchant interview, all three holds in six months were exchange disputes over courier charges); never show who complained; promise a complete, on-time response, not an outcome; AI writes only from the case file, tags every line with its proof, and never accuses the customer.
  - *Left out on purpose:* freezes on the merchant's own bank account (v1 exports the case file instead); large holds that already get a human case manager; contacting the customer or the police on the merchant's behalf; refunds and chargebacks.
  - *What we'd measure:* share of holds under ₹50,000 answered before the deadline; time from alert to submitted, median and 90th percentile (goal under 2 min); money released as a share of money held, and days on hold; guardrail: statements officers flag as inaccurate.
- Fine print: "Fictional merchant, customer and police data. Styled with Razorpay's open-source Blade design tokens; not a Razorpay product. A concept for the Razorpay x ISB AI x PM Build Challenge, by Jai Khurana."

---

## 10. Interaction details

- Back buttons use a navigation stack. Tabs reset it. Escape closes the sheet or the rail.
- Toasts appear above the footer for about 2.8 s. Push banners auto-hide after 7 s.
- The home alert card, the hold badges, the tab count and the Recovered amount all reflect state (on hold → under review → released).
- Uploaded images stay in the browser (object URLs); nothing is uploaded.
- State lives in memory; a reload restarts the demo. No localStorage needed.

---

## 11. Milestones (report and commit at each)

**M0 Repo.** In the project folder: `git init -b main`, confirm `.env.local` is ignored (`git check-ignore .env.local`), and make the first commit (`.gitignore`, `docs/brief.md`, an empty BUILD_LOG.md with the opening entry). If I'm on Windows, adapt every shell command in this brief.

**M1 Prove the model.** Load the key into the environment (for example `set -a; . ./.env.local; set +a`), list Groq models, confirm the two IDs, and make one tiny streaming request. Record the result in BUILD_LOG.md without the key.

**M2 Skeleton and design system.** Tokens, fonts, the phone frame and rail layout, both themes, phone-width behaviour, navigation and screen transitions, lock and home screens.

**M3 Hold flow.** Holds tab, Hold detail, Case file with the staggered reveal, and the evidence sheet (samples and real upload with tagging).

**M4 Statement and AI.** `case-data.js`, `api/draft.js`, `api/health.js`, the streaming client, proof chips, EN/HI, Edit/Shorter/Redraft/Stop, scripted fallback. Run it locally with the real key (`npx vercel dev`, or a tiny Node server that serves the static files and routes `/api/*` to the function modules). Confirm a real draft streams in both languages.

**M5 Submit to outcome.** Review, Submitted, Tracker with stages and push banners, Outcome, the timer.

**M6 Presenter rail.** Steps and jumps, Restart, Advance time, the AI toggle and status, notes, and the bottom sheet on phones.

**M7 Tests** (all green before deploying).
- `node --test` unit tests for the draft function with a mocked `fetch`: field whitelisting, oversized body, missing key, stream conversion (split chunks, reasoning deltas dropped, `[DONE]`), fallback on 429, all models failing, cache hit; plus the browser's text-cleaning function.
- Playwright e2e at 390×844 and 1440×900: the full happy path from lock screen to outcome; the fallback path with `/api/draft` mocked to 503; no console errors; no horizontal scroll; dark mode renders.
- npm scripts `test` and `test:e2e`.

**M8 Polish.** List real issues, then fix them. Check that dates are consistent (the story's "today" is Mon 5 Oct 2026), Hindi renders, contrast holds in dark mode, tap targets are big enough, and copy is plain.

**M9 GitHub.** Ask me public or private (my default: public, name `hold-rescue`). Then `gh repo create hold-rescue --public --source . --remote origin --push`.

**M10 Vercel.** After my OK:
- `npx vercel link` to a new project `hold-rescue` (framework "Other", no build command).
- Add the key without displaying it: `grep '^GROQ_API_KEY=' .env.local | cut -d= -f2- | tr -d '\r\n' | npx vercel env add GROQ_API_KEY production`, and the same for `preview`.
- `npx vercel git connect` so pushes to `main` auto-deploy.
- `npx vercel --prod`.

**M11 Verify production.**
- `GET /api/health` shows `"ai": true`.
- A `POST /api/draft` streams real text.
- The production domain opens with **no Vercel login wall** (check Deployment Protection: previews may be protected, production must not be).
- The Playwright happy path passes against the production URL.

**M12 Finish.** Put the live URL in README.md, finalise BUILD_LOG.md, commit and push. Then send me: the live URL, the repo URL, test results, what's real versus simulated, and known limits.

---

## 12. Definition of done

- [ ] The production URL works on a phone with no login, and the full flow from lock screen to outcome completes.
- [ ] gpt-oss-120b (or the verified fallback) drafts the statement live in English and Hindi, with proof chips.
- [ ] The scripted fallback works and is announced.
- [ ] `/api/health` shows `"ai": true` in production.
- [ ] Unit and e2e tests pass locally, and e2e passes against production.
- [ ] No secret in the repo or its history (`git log -p | grep -i gsk_` finds nothing).
- [ ] No Razorpay logo or name inside the phone UI; the disclaimers are present.
- [ ] README.md (what it is, live link, how to run, how to deploy) and BUILD_LOG.md are complete.

---

## 13. BUILD_LOG.md format (for the challenge submission)

Start with:
> **Research and product design (Claude on claude.ai, 1–5 Oct 2026):** problem discovery, a merchant interview, the MHA SOP and Supreme Court order, a review of platform gaps, choosing Hold Rescue over other ideas, the product scope, and the design direction. **Build (Claude Code, from scratch, starting <date>):** everything in this repository.

Then one entry per milestone:
- **When / goal**
- **What I asked** (one line)
- **What Claude did** (files, commands)
- **Decisions and trade-offs**, and why
- **How it was verified** (tests, manual checks, real API calls)
- **Real versus simulated**

End with an "AI in the product" section: which model and why an open one; how the prompt is restricted to the case file; how made-up facts and accusations are prevented (server-built prompt, evidence tags checked against the case file, the guard rules); and what happens on failure.

---

## 14. Out of scope

Real payment-gateway, police or national-portal integrations; logins; a database; reading uploaded screenshots with AI; analytics; screens beyond those listed.
