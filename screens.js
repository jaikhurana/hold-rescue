// One render function per screen. Each takes the app state and returns HTML.
// Rendering from state (rather than hand-written markup) keeps every badge, count and
// amount in step as the hold moves from "on hold" to "under review" to "released".
import { icon } from './icons.js';
import { CHAT, E5_LABELS, EVIDENCE, HOLD, HOME, LEDGER, LETTER, MERCHANT, OUTCOME, PAST_HOLDS, STAGES, e5Item, isExchangeDispute, timeline } from './case-data.js';
import { wordCount } from './statement.js';

export const NOT_IN_PROTOTYPE = 'Not part of this prototype.';

/** Status-bar tone per screen: white text on the lock screen and the navy home hero. */
export const TONE = { lock: 'on-dark', home: 'on-dark' };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** 'hold' before the merchant responds, 'review' after, 'released' once police lift it. */
export function holdState(s) {
  if (s.stage >= 3) return 'released';
  return s.submitted ? 'review' : 'hold';
}

// ───────────── Shared pieces ─────────────

function appbar(title, { back = true, end = '' } = {}) {
  return `
    <header class="appbar">
      ${back ? `<button class="icon-btn" type="button" data-action="back" aria-label="Back">${icon('back', 22)}</button>` : ''}
      <h2 tabindex="-1">${title}</h2>
      ${end}
    </header>`;
}

function tabbar(s, active) {
  const tabs = [
    ['home', 'Home', 'home'],
    ['payments', 'Payments', 'card'],
    ['holds', 'Holds', 'pause'],
    ['account', 'Account', 'user'],
  ];
  return `
    <nav class="tabbar" aria-label="Main">
      ${tabs
        .map(
          ([id, label, ic]) => `
        <button class="tab" type="button" data-action="tab" data-arg="${id}"${id === active ? ' aria-current="page"' : ''}>
          ${icon(ic, 22)}<span>${label}</span>
          ${id === 'holds' && !s.submitted ? '<span class="count"><span class="sr-only">, </span>1<span class="sr-only"> needs action</span></span>' : ''}
        </button>`,
        )
        .join('')}
    </nav>`;
}

// ───────────── 1. Lock screen ─────────────

function lock() {
  return `
    <div class="screen-fill lock">
      <h2 class="sr-only" tabindex="-1">Lock screen</h2>
      <div class="lock-clock" aria-hidden="true">
        <p class="lock-date">Monday, 5 October</p>
        <p class="lock-time">10:12</p>
      </div>
      <div class="lock-notifs">
        <button class="notif" type="button" data-action="open-alert">
          <span class="app-glyph" aria-hidden="true">₹</span>
          <span class="notif-text">
            <span class="notif-meta"><b>Payments</b><span>now</span></span>
            <strong>${HOLD.amount} is on hold after a police complaint</strong>
            <span>Order ${HOLD.order}. Respond by ${HOLD.respondBy} to get it back. Takes about 2 minutes.</span>
          </span>
        </button>
        <div class="notif dim">
          <span class="app-glyph" aria-hidden="true">₹</span>
          <span class="notif-text">
            <span class="notif-meta"><b>Payments</b><span>Sun</span></span>
            <strong>Settlement of ₹21,940 sent to your bank</strong>
          </span>
        </div>
        <p class="lock-hint">Tap the alert to open it</p>
      </div>
    </div>`;
}

// ───────────── 2. Home ─────────────

function alertCard(s) {
  const state = holdState(s);
  const copy = {
    hold: { ic: 'lock', eyebrow: `Action needed · ${HOLD.daysLeft} days left`, title: `${HOLD.amount} on hold after a police complaint`, sub: `Order ${HOLD.order} · respond by ${HOLD.respondBy}` },
    review: { ic: 'clock', eyebrow: 'Under review', title: `Your response on ${HOLD.amount} is filed`, sub: `Order ${HOLD.order} · we’ll tell you when the officer replies` },
    released: { ic: 'checkCircle', eyebrow: 'Hold lifted', title: `${HOLD.amount} is back in your settlement`, sub: `Order ${HOLD.order} · added on Sat 17 Oct` },
  }[state];
  return `
    <button class="alert-card ${state}" type="button" data-action="open-hold">
      <span class="alert-ic">${icon(copy.ic, 22)}</span>
      <span>
        <span class="eyebrow">${copy.eyebrow}</span>
        <span class="alert-title">${copy.title}</span>
        <span class="alert-sub">${copy.sub}</span>
      </span>
      ${icon('chevron', 20)}
    </button>`;
}

function home(s) {
  const released = holdState(s) === 'released';
  const quick = [
    ['Payment links', 'link', 'na'],
    ['QR codes', 'qr', 'na'],
    ['Refunds', 'refund', 'na'],
  ];
  return `
    <div class="body flush">
      <header class="hero">
        <div class="hero-top">
          <span class="avatar" aria-hidden="true">${MERCHANT.initials}</span>
          <div class="hero-id">
            <h2 tabindex="-1">${MERCHANT.store}</h2>
            <p><span class="dot live" aria-hidden="true"></span>Live mode · ${MERCHANT.city}</p>
          </div>
          <button class="icon-btn" type="button" data-action="na" aria-label="Notifications">${icon('bell', 22)}</button>
        </div>
        <p class="hero-label">Next settlement · ${HOME.nextSettlement}</p>
        <p class="amount">${HOME.settlement}</p>
        <span class="hero-chip">
          <span class="dot ${released ? 'ok' : 'hold'}" aria-hidden="true"></span>
          ${released ? `${HOLD.amount} released · added on Sat 17 Oct` : `${HOLD.amount} held back from this settlement`}
        </span>
      </header>

      <section class="home-sec" aria-label="Quick actions">
        <div class="qa">
          ${quick
            .map(([label, ic, action]) => `
            <button class="qa-btn" type="button" data-action="${action}">
              <span class="qa-ic">${icon(ic, 22)}</span>${label}
            </button>`)
            .join('')}
          <button class="qa-btn hot" type="button" data-action="tab" data-arg="holds">
            <span class="qa-ic">${icon('pause', 22)}</span>Holds
            <span class="new-tag">NEW</span>
          </button>
        </div>
      </section>

      <section class="home-sec" aria-label="Alerts">${alertCard(s)}</section>

      <section class="home-sec" aria-labelledby="today-h">
        <div class="sec-head"><h3 id="today-h">Today's payments</h3><span>${HOME.todayTotal} · ${HOME.payments.length}</span></div>
        <div class="list">
          ${HOME.payments
            .map((p) => `
            <div class="row">
              <span class="row-ic">${icon(p.method === 'Card' ? 'card' : 'bolt', 18)}</span>
              <span class="row-main"><span class="row-title">${p.order}</span><span class="row-sub">${p.method} · ${p.time}</span></span>
              <span class="row-end">${p.amount}<span class="badge pos">Captured</span></span>
            </div>`)
            .join('')}
        </div>
      </section>
    </div>
    ${tabbar(s, 'home')}`;
}

function statusBadge(s) {
  const [cls, label] = { hold: ['neg', 'On hold'], review: ['notice', 'Under review'], released: ['pos', 'Released'] }[holdState(s)];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ───────────── 3. Holds tab ─────────────

function holds(s) {
  const released = holdState(s) === 'released';
  return `
    ${appbar('Holds', { back: false })}
    <div class="body">
      <p class="intro">Money held back from your settlements because police or a bank asked for it.</p>
      <div class="ledger">
        <div class="ledger-cell"><span class="eyebrow">Lost in 2026</span><span class="ledger-amt neg">${LEDGER.lost}</span></div>
        <div class="ledger-cell"><span class="eyebrow">Recovered</span><span class="ledger-amt${released ? ' pos' : ''}">${released ? LEDGER.recovered : '₹0'}</span></div>
      </div>

      <h3 class="sec-title">${released ? 'Resolved' : 'Active'}</h3>
      <button class="hold-card" type="button" data-action="open-hold">
        <span class="row-ic tint-hold">${icon('police', 20)}</span>
        <span class="row-main">
          <span class="row-title">${HOLD.order} · police complaint</span>
          <span class="row-sub">${HOLD.stationShort} · held ${HOLD.placedOn.replace(" ", "&nbsp;")}</span>
        </span>
        <span class="row-end">${HOLD.amount}${statusBadge(s)}</span>
      </button>

      <h3 class="sec-title">Earlier this year</h3>
      <div class="list">
        ${PAST_HOLDS.map((h) => `
          <div class="row">
            <span class="row-ic">${icon('pause', 18)}</span>
            <span class="row-main">
              <span class="row-title">${h.order} · ${h.when}</span>
              <span class="row-sub">Not answered. Returned to the complainant.</span>
            </span>
            <span class="row-end"><span class="neg-amt">${h.amount}</span><span class="badge neg">Lost</span></span>
          </div>`).join('')}
      </div>
      <p class="note">Both were small orders. No one on the team had time to follow up before the deadline.</p>
    </div>
    ${tabbar(s, 'holds')}`;
}

// ───────────── 4. Hold detail ─────────────

function hold(s) {
  const deadline = s.submitted
    ? `<div class="banner pos">${icon('checkCircle')}
         <p><strong>Response submitted</strong><br>We file it on the national grievance portal by ${HOLD.respondBy} and tell you when the officer replies.</p>
       </div>`
    : `<div class="banner notice">${icon('clock')}
         <div class="deadline">
           <p class="deadline-row"><strong>Respond by ${HOLD.respondBy}</strong><span>${HOLD.daysLeft} days left</span></p>
           <div class="progress" aria-hidden="true"><span></span></div>
         </div>
       </div>`;
  return `
    ${appbar('Payment on hold')}
    <div class="body">
      <section class="card summary" aria-label="Hold summary">
        <div class="summary-top"><span class="eyebrow">Amount on hold</span>${statusBadge(s)}</div>
        <p class="amount">${HOLD.amount}</p>
        <p class="small muted">Order ${HOLD.order} · held from your settlement on ${HOLD.placedOn}</p>
      </section>
      ${deadline}
      <section class="card prose">
        <h3>What happened</h3>
        <p>A cyber-crime complaint filed with police in Lucknow names this payment. The law requires us to hold the amount until police decide. The money is safe with us.</p>
        <h3>If you don't respond</h3>
        <p>For amounts under ₹50,000, police can hand the money to the person who complained, without an FIR. <strong>That is how ${LEDGER.lost} went on two holds this year.</strong></p>
      </section>
      <div class="banner info">${icon('truck')}
        <p><strong>Delivered with OTP on 18 Sep</strong> · No refund or return on record. If the customer asked for an exchange, that chat is your strongest proof.</p>
      </div>
      <dl class="card facts">
        <div><dt>Police station</dt><dd>${HOLD.stationShort}</dd></div>
        <div><dt>Complaint ref.</dt><dd class="mono-ink">${HOLD.complaintRef}</dd></div>
        <div><dt>Complaint filed</dt><dd>${HOLD.complaintFiled}</dd></div>
        <div><dt>Who complained</dt><dd class="with-ic">${icon("private", 16)}Kept private by law</dd></div>
      </dl>
    </div>
    <footer class="footer">
      ${s.submitted
        ? '<button class="btn btn-primary btn-block" type="button" data-action="go" data-arg="tracker">Track progress</button>'
        : '<button class="btn btn-primary btn-block" type="button" data-action="go" data-arg="casefile">Build my response <span class="meta">· about 2 min</span></button>'}
    </footer>`;
}

// ───────────── 5. Case file ─────────────

/** The sample chat, drawn as a generic chat app. Sizes are in cqw so it scales to any frame. */
export function chatShot() {
  return `
    <div class="chatshot">
      <div class="cs-status"><span>10:32</span></div>
      <div class="cs-head">
        <span class="cs-avatar"></span>
        <span class="cs-who"><b>${CHAT.name}</b><small>${CHAT.number}</small></span>
      </div>
      <div class="cs-body">
        <span class="cs-date">${CHAT.date}</span>
        ${CHAT.messages.map((m) => `<p class="cs-msg ${m.from}">${esc(m.text)}<time>${m.time}</time></p>`).join('')}
      </div>
    </div>`;
}

function evidenceCard(item, i, animate, s) {
  let body = '';
  if (item.quote) body = `<blockquote class="ev-quote">“${item.quote}”</blockquote>`;
  else if (item.id === 'E5' && s.e5?.kind === 'chat') {
    body = `<div class="ev-attach"><span class="shot shot-mini" aria-hidden="true">${chatShot()}</span><p class="ev-shown">${item.shown}</p></div>`;
  } else if (item.id === 'E5' && s.upload) {
    body = `<div class="ev-attach"><span class="shot shot-mini"><img src="${s.upload.url}" alt="Your screenshot"></span><p class="ev-shown">${item.shown}</p></div>`;
  } else {
    body = `<p class="ev-shown">${item.shown}</p>${item.code ? `<p class="mono">${item.code}</p>` : ''}`;
  }
  return `
    <article class="ev${animate ? ' stagger' : ''}" style="--i:${i}" aria-label="${item.id}: ${esc(item.title)}">
      <div class="ev-head">
        <span class="ev-id">${item.id}</span>
        <div class="ev-titles"><h3>${esc(item.title)}</h3><p class="ev-src">${item.src}</p></div>
        <span class="ev-ok">${icon('checkCircle', 22)}<span class="sr-only">Ready</span></span>
      </div>
      ${body}
    </article>`;
}

function missingCard(animate) {
  return `
    <article class="ev missing${animate ? ' stagger' : ''}" style="--i:4" aria-label="E5: missing">
      <div class="ev-head">
        <span class="ev-id">E5</span>
        <div class="ev-titles"><h3>Customer's exchange request</h3><p class="ev-src">Missing · probably on your phone</p></div>
      </div>
      <p class="ev-shown">Add the chat where the customer asked for an exchange. It shows the officer this is an exchange dispute, not fraud.</p>
      <button class="btn btn-secondary btn-sm ev-btn" type="button" data-action="sheet-open">${icon('phone', 18)}Add from phone</button>
    </article>`;
}

function casefile(s) {
  const animate = !s.caseRevealed;
  const e5 = e5Item(s.e5);
  const count = EVIDENCE.length + (e5 ? 1 : 0);
  let status = 'Built from your account in 3 s';
  if (e5) status = isExchangeDispute(s.e5) ? 'Exchange dispute, not fraud' : 'Ordered, paid and delivered';
  return `
    ${appbar('Case file')}
    <div class="body">
      <section class="file-cover" aria-label="Case file cover">
        <div class="file-top">
          <span class="file-title">Case file</span>
          <span class="file-count${count === 5 ? ' full' : ''}">${count} of 5 ready</span>
        </div>
        <dl class="file-lines">
          <div><dt>File no.</dt><dd>${HOLD.order}</dd></div>
          <div><dt>Subject</dt><dd>Hold of ${HOLD.amount}, police complaint</dd></div>
          <div><dt>Status</dt><dd>${status}</dd></div>
        </dl>
      </section>
      ${EVIDENCE.map((item, i) => evidenceCard(item, i, animate, s)).join('')}
      ${e5 ? evidenceCard(e5, 4, animate || s.justAdded, s) : missingCard(animate)}
    </div>
    <footer class="footer">
      ${e5
        ? '<button class="btn btn-primary btn-block" type="button" data-action="go" data-arg="statement">Draft my statement</button>'
        : `<button class="btn btn-primary btn-block" type="button" data-action="sheet-open">Add the customer's chat</button>
           <button class="btn btn-text btn-block" type="button" data-action="go" data-arg="statement">Continue without it</button>`}
    </footer>`;
}

// ───────────── 6. "Add from your phone" sheet ─────────────

export function sheetFrame() {
  return `
    <div class="sheet-scrim" data-action="sheet-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-head">
        <span class="grabber" aria-hidden="true"></span>
        <h2 id="sheet-title" tabindex="-1">Add from your phone</h2>
        <button class="icon-btn" type="button" data-action="sheet-close" aria-label="Close">${icon('close', 22)}</button>
      </div>
      <div class="sheet-body" id="sheet-body"></div>
    </div>`;
}

/** Body of the evidence sheet for the current view: pick · reading · read · tag. */
export function sheetBody(s) {
  const view = s.sheet?.view;
  if (view === 'reading' || view === 'read') {
    const reading = view === 'reading';
    return `
      <div class="shot shot-lg${reading ? ' scan' : ''}" role="img" aria-label="Chat screenshot from 19 Sep">${chatShot()}</div>
      ${reading
        ? '<p class="reading" role="status"><span class="spinner" aria-hidden="true"></span>Reading the screenshot…</p>'
        : `<div class="what" role="status">
             <p class="eyebrow">What it shows</p>
             <ul>
               <li><strong>19 Sep, 10:04</strong> · Customer asks to swap size M for L.</li>
               <li><strong>10:31</strong> · Refuses the ₹120 return courier and says they'll complain.</li>
             </ul>
             <p class="match">${icon('checkCircle', 18)}Number ending 4417 matches order ${HOLD.order}</p>
           </div>
           <button class="btn btn-primary btn-block" type="button" data-action="add-chat">Add to case file</button>
           <button class="btn btn-text btn-block" type="button" data-action="sheet-view" data-arg="pick">Pick a different screenshot</button>`}`;
  }
  if (view === 'tag') {
    return `
      <img class="picked" src="${s.sheet.url}" alt="The screenshot you picked">
      <p class="sheet-q" id="tag-q">What does it show?</p>
      <div class="chips" role="group" aria-labelledby="tag-q">
        <button class="chip" type="button" data-action="add-tag" data-arg="0">Exchange request</button>
        <button class="chip" type="button" data-action="add-tag" data-arg="1">Delivery proof</button>
        <button class="chip" type="button" data-action="add-tag" data-arg="2">Something else</button>
      </div>
      <button class="btn btn-text btn-block" type="button" data-action="sheet-view" data-arg="pick">Pick a different screenshot</button>`;
  }
  return `
    <p class="intro">Screenshots taken after delivery on 18 Sep. One of them mentions this order.</p>
    <div class="thumbs">
      <button class="thumb pick" type="button" data-action="sample" data-arg="chat" aria-label="Chat screenshot, 19 Sep, 10:32. Mentions an exchange.">
        <span class="shot" aria-hidden="true">${chatShot()}</span>
        <span class="badge info wrap">Mentions an exchange</span>
        <span class="thumb-cap">19 Sep · 10:32</span>
      </button>
      <button class="thumb" type="button" data-action="sample" data-arg="photo" aria-label="Product photo, 18 Sep, 13:40">
        <span class="shot photoshot" aria-hidden="true">${icon('shirt', 48)}</span>
        <span class="thumb-cap">18 Sep · 13:40</span>
      </button>
      <button class="thumb" type="button" data-action="sample" data-arg="payment" aria-label="Payment screenshot, 14 Sep, 19:43">
        <span class="shot payshot" aria-hidden="true">
          <span class="ps-check">${icon('check', 18)}</span><span class="ps-label">Paid</span><span class="ps-amt">₹1,800</span><span class="ps-meta">UPI · 14 Sep</span>
        </span>
        <span class="thumb-cap">14 Sep · 19:43</span>
      </button>
    </div>
    <button class="btn btn-secondary btn-block" type="button" data-action="pick-file">${icon('image', 18)}Choose another screenshot</button>
    <p class="fine-print">Prototype: these three screenshots are samples. You can also pick a real image.</p>`;
}

/** The labels a merchant can give an uploaded screenshot (index matches the chips above). */
export const TAG_LABELS = E5_LABELS;

// ───────────── 7. Your statement ─────────────

export const draftKey = (s) => `${s.lang}|${s.variant}`;
export const currentDraft = (s) => s.drafts[draftKey(s)] ?? null;

/** Statement text with every [E1]–[E5] as a small tappable proof chip. */
function withTags(text) {
  return text
    .split(/(\[E\d\])/)
    .map((part) => {
      const tag = part.match(/^\[(E\d)\]$/);
      return tag
        ? `<button class="tag" type="button" data-action="proof" data-arg="${tag[1]}" aria-label="Proof ${tag[1]}">${tag[1]}</button>`
        : esc(part);
    })
    .join('');
}

/** The parts of the statement screen that change while drafting, rendered separately. */
export function statementParts(s) {
  const job = s.drafting?.key === draftKey(s) ? s.drafting : null;
  const draft = currentDraft(s);
  const busy = Boolean(job) || s.editing;

  let source;
  if (job && job.phase !== 'typing') source = `<p class="source live"><span class="live-dot" aria-hidden="true"></span>Drafting live with ${job.model} · open model</p>`;
  else if (job || !draft || draft.source === 'scripted') source = `<p class="source scripted">${icon('file', 16)}Standard draft from your case file</p>`;
  else if (draft.source === 'edited') source = `<p class="source edited">${icon('edit', 16)}Edited by you</p>`;
  else source = `<p class="source live">${icon('checkCircle', 16)}Drafted live by ${draft.model} · open model</p>`;

  let text = '';
  if (s.editing && draft) {
    text = `<label class="sr-only" for="st-edit">Edit your statement</label><textarea id="st-edit" class="edit-area" spellcheck="true">${esc(draft.text)}</textarea>`;
  } else if (job && !job.text) {
    text = '<p class="drafting-note"><span class="spinner" aria-hidden="true"></span>Drafting from your case file…</p>';
  } else if (job) {
    text = `<p>${withTags(job.text)}<span class="caret" aria-hidden="true"></span></p>`;
  } else if (draft) {
    text = `<p>${withTags(draft.text)}</p>`;
  }

  let tools;
  if (s.editing) {
    tools = `<button class="chip" type="button" data-action="edit-done">${icon('check', 16)}Done</button>`;
  } else if (job && job.phase !== 'typing') {
    tools = `<button class="chip" type="button" data-action="stop">${icon('stop', 16)}Stop</button>`;
  } else {
    const off = job ? ' disabled' : '';
    tools = `
      <button class="chip" type="button" data-action="edit"${off}>${icon('edit', 16)}Edit</button>
      <button class="chip" type="button" data-action="shorter" aria-pressed="${s.variant === 'shorter'}"${off}>${icon('shorter', 16)}Shorter</button>
      <button class="chip" type="button" data-action="redraft"${off}>${icon('redraft', 16)}Redraft</button>`;
  }
  return { source, text, tools, busy };
}

function statement(s) {
  const letter = LETTER[s.lang];
  const p = statementParts(s);
  const lockLang = s.editing ? ' disabled' : '';
  const langToggle = `
    <div class="seg seg-lang" role="group" aria-label="Language">
      <button type="button" data-action="lang" data-arg="en" aria-pressed="${s.lang === 'en'}"${lockLang}>EN</button>
      <button type="button" data-action="lang" data-arg="hi" aria-pressed="${s.lang === 'hi'}" lang="hi"${lockLang}>हिंदी</button>
    </div>`;
  return `
    ${appbar('Your statement', { end: langToggle })}
    <div class="body">
      <div id="st-source">${p.source}</div>
      <article class="letter" lang="${s.lang}" aria-label="Statement to the investigating officer">
        <p class="letter-to">${letter.to}</p>
        <p class="letter-re">${letter.re}</p>
        <div class="letter-text" id="st-text" aria-busy="${p.busy}">${p.text}</div>
        <p class="letter-sign">${letter.sign}</p>
      </article>
      <div class="tools" id="st-tools" role="group" aria-label="Statement tools">${p.tools}</div>
      <p class="guard">${icon('shield', 18)}<span>AI writes only from your case file. It won't add facts or accuse your customer. Tap a tag to see its proof.</span></p>
    </div>
    <footer class="footer">
      <button class="btn btn-primary btn-block" id="st-submit" type="button" data-action="go" data-arg="review"${p.busy ? ' disabled' : ''}>Review and submit</button>
    </footer>`;
}

// ───────────── Timer formatting ─────────────

/** Measured alert-to-submit time in ms, or null if it wasn't measured. */
export function measuredMs(s) {
  return s.timer.start && s.timer.end ? s.timer.end - s.timer.start : null;
}

/** 84 000 → "1:24" */
export function clock(ms) {
  const secs = Math.floor(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

/** 84 000 → "1 min 24 s" */
export function inWords(ms) {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  return mins ? `${mins} min ${secs % 60} s` : `${secs} s`;
}

// ───────────── 8. Review and submit ─────────────

export const CALL_TIMES = [
  ['mornings', 'Weekday mornings'],
  ['evenings', 'Weekday evenings'],
  ['any', 'Any time'],
];

function review(s) {
  const draft = currentDraft(s);
  const items = EVIDENCE.length + (e5Item(s.e5) ? 1 : 0);
  const route = [
    ['You send it from here', 'Case file and statement, in one tap'],
    ['Our grievance desk files it', 'On the national cyber-crime grievance portal, within 7 days'],
    ['The investigating officer decides', `${HOLD.stationShort} · within 15 days of filing`],
  ];
  return `
    ${appbar('Review and submit')}
    <div class="body">
      <section class="card" aria-labelledby="route-h">
        <p class="eyebrow" id="route-h">What happens next</p>
        <ol class="route">
          ${route.map(([title, sub], i) => `<li><span class="route-n">${i + 1}</span><span><strong>${title}</strong><span>${sub}</span></span></li>`).join('')}
        </ol>
      </section>
      <dl class="card facts" aria-label="What you are sending">
        <div><dt>Case file</dt><dd>${items} items</dd></div>
        <div><dt>Statement</dt><dd>${s.lang === 'hi' ? 'Hindi' : 'English'} · <span id="word-count">${wordCount(draft?.text)}</span> words</dd></div>
        <div><dt>Video call contact</dt><dd>${MERCHANT.videoContact}</dd></div>
      </dl>
      <section aria-labelledby="call-h">
        <h3 class="sec-title" id="call-h">Best time for a video call</h3>
        <div class="chips call-chips" role="group" aria-labelledby="call-h">
          ${CALL_TIMES.map(([id, label]) => `<button class="chip" type="button" data-action="call-time" data-arg="${id}" aria-pressed="${s.callTime === id}">${label}</button>`).join('')}
        </div>
      </section>
      <label class="declare">
        <input type="checkbox" id="declare" data-change="declare"${s.declared ? ' checked' : ''}${s.submitting ? ' disabled' : ''}>
        <span>I confirm these facts are true. I understand that a false statement is an offence.</span>
      </label>
    </div>
    <footer class="footer">
      <button class="btn btn-primary btn-block" id="submit" type="button" data-action="submit"${!s.declared || s.submitting ? ' disabled' : ''}>
        ${s.submitting ? '<span class="spinner" aria-hidden="true"></span>Sending your case file…' : `${icon('send', 18)}Submit response`}
      </button>
      <p class="fine-print">Prototype: nothing is actually sent.</p>
    </footer>`;
}

// ───────────── 9. Response submitted ─────────────

function submitted(s) {
  const ms = measuredMs(s);
  return `
    <div class="body top-pad">
      <div class="success">
        <span class="success-check" aria-hidden="true">${icon('check', 40)}</span>
        <h2 tabindex="-1">Response submitted</h2>
        <p>We file it on the national grievance portal and tell you the moment the officer replies. Nobody on your team needs to follow up.</p>
      </div>
      ${ms !== null
        ? `<section class="card time-card" aria-label="Time from alert to submitted">
             <span class="eyebrow">Alert to submitted</span>
             <span class="amount">${clock(ms)}</span>
             <span class="small ${ms <= 120_000 ? 'ok-text' : 'muted'}">${ms <= 120_000 ? 'Under the 2-minute goal' : 'Goal: under 2:00'}</span>
           </section>`
        : ''}
      <dl class="card facts">
        <div><dt>Reference</dt><dd class="mono-ink">${HOLD.reference}</dd></div>
        <div><dt>Submitted</dt><dd>${HOLD.submittedOn}</dd></div>
        <div><dt>Filed on portal by</dt><dd>${HOLD.respondBy}</dd></div>
        <div><dt>Reminders</dt><dd>On</dd></div>
      </dl>
    </div>
    <footer class="footer">
      <button class="btn btn-primary btn-block" type="button" data-action="track">Track this hold</button>
    </footer>`;
}

// ───────────── 10. Tracker ─────────────

const STATE_LABEL = { done: 'Done', now: 'In progress', next: 'Up next', faded: 'No longer needed' };

function tracker(s) {
  const ms = measuredMs(s);
  const items = timeline(s.stage, ms !== null ? inWords(ms) : null);
  const next = STAGES[s.stage + 1];
  return `
    ${appbar(`Hold · ${HOLD.order}`)}
    <div class="body">
      <section class="card summary" aria-label="Hold summary">
        <div class="summary-top"><span class="eyebrow">${s.stage >= 3 ? 'Released' : 'Amount on hold'}</span>${statusBadge(s)}</div>
        <p class="amount">${HOLD.amount}</p>
        <p class="small muted with-ic">${icon('police', 16)}${HOLD.stationShort}</p>
      </section>
      <ol class="timeline" aria-label="Progress">
        ${items.map((item) => `
          <li class="tl ${item.state}">
            <span class="tl-mark" aria-hidden="true">${item.state === 'done' ? icon('check', 14) : ''}</span>
            <div class="tl-body">
              <p class="tl-title">${item.title}<span class="sr-only"> (${STATE_LABEL[item.state]})</span></p>
              <p class="tl-when">${item.when}</p>
              ${item.text ? `<p class="tl-text">${item.text}</p>` : ''}
              ${item.checklist
                ? `<div class="checklist"><p class="eyebrow">Before the call</p><ul>${item.checklist.map((c) => `<li>${icon('check', 16)}<span>${c}</span></li>`).join('')}</ul></div>`
                : ''}
            </div>
          </li>`).join('')}
      </ol>
      <div class="banner info">${icon('bell')}
        <p><strong>Reminders on</strong> · We alert you before each deadline, so nobody on your team has to keep track.</p>
      </div>
      ${next ? `<button class="demo-skip" type="button" data-action="advance">${icon('forward', 16)}Demo · Skip ahead to ${next.date}</button>` : ''}
    </div>
    ${s.stage >= 3
      ? '<footer class="footer"><button class="btn btn-primary btn-block" type="button" data-action="go" data-arg="outcome">See the result</button></footer>'
      : ''}`;
}

// ───────────── 11. Outcome ─────────────

function outcome(s) {
  const ms = measuredMs(s);
  return `
    <div class="body top-pad">
      <div class="success">
        <span class="success-check" aria-hidden="true">${icon('check', 40)}</span>
        <h2 tabindex="-1">Hold lifted</h2>
        <p class="amount ok-text">${HOLD.amount}</p>
        <p>Back in your settlement on ${OUTCOME.creditedOn}.</p>
      </div>
      <dl class="card facts">
        ${ms !== null ? `<div><dt>Your time on it</dt><dd>${inWords(ms)}</dd></div>` : ''}
        <div><dt>Days on hold</dt><dd>${OUTCOME.daysOnHold}</dd></div>
        <div><dt>Released on</dt><dd>${OUTCOME.releasedOn}</dd></div>
        <div><dt>Lost earlier this year</dt><dd>${LEDGER.lost} on ${LEDGER.lostHolds} holds</dd></div>
      </dl>
    </div>
    <footer class="footer">
      <button class="btn btn-primary btn-block" type="button" data-action="done">Done</button>
    </footer>`;
}

/** An in-app push banner, as the "Payments" app would show it. */
export function pushBanner(push) {
  return `
    <button class="push" type="button" data-action="push-open" data-arg="${push.open}">
      <span class="app-glyph" aria-hidden="true">₹</span>
      <span class="notif-text">
        <span class="notif-meta"><b>Payments</b><span>now</span></span>
        <strong>${push.title}</strong>
        <span>${push.body}</span>
      </span>
    </button>`;
}

export const SCREENS = {
  lock,
  home,
  holds,
  hold,
  casefile,
  statement,
  review,
  submitted,
  tracker,
  outcome,
};

/** Which presenter-rail step (1–7) a screen belongs to. */
export function stepOf(s) {
  const map = { lock: 1, home: 1, holds: 2, hold: 2, casefile: s.sheet ? 4 : 3, statement: 5, review: 6, submitted: 7, tracker: 7, outcome: 7 };
  return map[s.screen] ?? 1;
}
