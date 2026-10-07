// One render function per screen. Each takes the app state and returns HTML.
// Rendering from state (rather than hand-written markup) keeps every badge, count and
// amount in step as the hold moves from "on hold" to "under review", "action ready" and "released".
import { icon } from './icons.js';
import { activity, addDays, evaluate, fmtDate, outcome as outcomeOf, timeline } from './agent.js';
import {
  AGENT_COPY, AGENT_LETTERS, CALL_BRIEF, CHAT, E5_LABELS, EVIDENCE, HOLD, HOME, LEDGER, LETTER, MERCHANT, PAST_HOLDS, SCENARIOS, e5Item, isExchangeDispute,
} from './case-data.js';
import { parseCallBrief, wordCount } from './statement.js';

export const NOT_IN_PROTOTYPE = 'Not part of this prototype.';

/** Status-bar tone per screen: white text on the lock screen's wallpaper, dark elsewhere. */
export const TONE = { lock: 'on-dark' };

/** "₹23,480" → ₹23,480 with a lighter ".00", the way the merchant app shows amounts. */
export const money = (amount) => `<span class="money">${amount}<span class="paise">.00</span></span>`;

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** The story's date: the current step of the chosen scenario (Mon 5 Oct 2026 until time moves). */
export const storyNow = (s) => SCENARIOS[s.scenario][s.step].on;

/** What the follow-up agent sees right now (see agent.js). */
export const agentView = (s) => evaluate(s.case, storyNow(s));

/** The first agent proposal still waiting for the merchant, if any. */
export const waitingProposal = (s) => (s.submitted ? (agentView(s).proposals[0] ?? null) : null);

/** 'hold' before the merchant responds, 'review' after, 'action' while the agent needs an OK, 'released' at the end. */
export function holdState(s) {
  if (s.submitted && agentView(s).released) return 'released';
  if (waitingProposal(s)) return 'action';
  return s.submitted ? 'review' : 'hold';
}

// ───────────── Shared pieces ─────────────

/** A tab screen's large title, as in the current merchant app. */
function pageHead(title) {
  return `<header class="page-head"><h2 tabindex="-1">${title}</h2></header>`;
}

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
    ['support', 'Support', 'help'],
    ['account', 'Account', 'user'],
  ];
  return `
    <nav class="tabbar" aria-label="Main">
      ${tabs
        .map(
          ([id, label, ic]) => `
        <button class="tab" type="button" data-action="tab" data-arg="${id}"${id === active ? ' aria-current="page"' : ''}>
          ${icon(ic, 22)}<span>${label}</span>
          ${id === 'holds' && (!s.submitted || waitingProposal(s)) ? '<span class="count"><span class="sr-only">, </span>1<span class="sr-only"> needs action</span></span>' : ''}
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
            <strong>${HOLD.amount} on hold: a cyber-fraud report names this payment</strong>
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
  const waiting = waitingProposal(s);
  const released = outcomeOf(s.case);
  const copy = {
    action: waiting && {
      ic: 'spark',
      eyebrow: 'Action ready',
      title: AGENT_COPY[waiting.type].ready,
      sub: waiting.type === 'call_brief' ? 'Tap to review' : 'Tap to review and send',
    },
    hold: { ic: 'lock', eyebrow: `Action needed · ${HOLD.daysLeft} days left`, title: `${HOLD.amount} on hold after a cyber-fraud report`, sub: `Order ${HOLD.order} · respond by ${HOLD.respondBy}` },
    review: { ic: 'clock', eyebrow: 'Under review', title: `Your response on ${HOLD.amount} is filed`, sub: `Order ${HOLD.order} · we’ll tell you when the officer replies` },
    released: released && { ic: 'checkCircle', eyebrow: 'Hold lifted', title: `${HOLD.amount} is back in your settlement`, sub: `Order ${HOLD.order} · added on ${fmtDate(released.creditedOn)}` },
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
      <header class="home-top">
        <span class="avatar" aria-hidden="true">${MERCHANT.initials}</span>
        <div class="home-id">
          <p>Good morning · ${MERCHANT.city}</p>
          <h2 tabindex="-1">${MERCHANT.store}</h2>
        </div>
        <span class="live-pill"><span class="dot live" aria-hidden="true"></span>Live mode</span>
        <button class="icon-btn" type="button" data-action="na" aria-label="Notifications">${icon('bell', 22)}</button>
      </header>

      <section class="home-sec" aria-label="Next settlement">
        <div class="card balance-card">
          <p class="balance-label">Next settlement · ${fmtDate(addDays(storyNow(s), 1))}</p>
          <p class="amount">${money(HOME.settlement)}</p>
          <p class="balance-sub">
            <span class="dot ${released ? 'ok' : 'hold'}" aria-hidden="true"></span>
            ${released ? `Includes ${HOLD.amount} released from the hold` : `${HOLD.amount} held back from this settlement`}
          </p>
        </div>
      </section>

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
              <span class="row-end">${money(p.amount)}<span class="badge pos">Captured</span></span>
            </div>`)
            .join('')}
        </div>
      </section>
    </div>
    ${tabbar(s, 'home')}`;
}

function statusBadge(s) {
  const state = holdState(s);
  if (state === 'action') return `<span class="badge info">${AGENT_COPY[waitingProposal(s).type].badge}</span>`;
  const [cls, label] = { hold: ['neg', 'On hold'], review: ['notice', 'Under review'], released: ['pos', 'Released'] }[state];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ───────────── 3. Holds tab ─────────────

function holds(s) {
  const released = holdState(s) === 'released';
  return `
    ${pageHead('Holds')}
    <div class="body">
      <p class="intro">Money held back from your settlements because police or a bank asked for it.</p>
      <div class="ledger">
        <div class="ledger-cell"><span class="eyebrow">Lost in 2026</span><span class="ledger-amt neg">${money(LEDGER.lost)}</span></div>
        <div class="ledger-cell"><span class="eyebrow">Recovered</span><span class="ledger-amt${released ? ' pos' : ''}">${money(released ? LEDGER.recovered : '₹0')}</span></div>
      </div>

      <h3 class="sec-title">${released ? 'Resolved' : 'Active'}</h3>
      <button class="hold-card" type="button" data-action="open-hold">
        <span class="row-ic tint-hold">${icon('police', 20)}</span>
        <span class="row-main">
          <span class="row-title">${HOLD.order} · cyber-fraud report</span>
          <span class="row-sub">${HOLD.stationShort} · held ${HOLD.placedOn.replace(" ", "&nbsp;")}</span>
        </span>
        <span class="row-end">${money(HOLD.amount)}${statusBadge(s)}</span>
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
            <span class="row-end"><span class="neg-amt">${money(h.amount)}</span><span class="badge neg">Lost</span></span>
          </div>`).join('')}
      </div>
      <p class="note">Both were small orders. No one on the team had time to follow up before the deadline.</p>
    </div>
    ${tabbar(s, 'holds')}`;
}

// ───────────── 4. Hold detail ─────────────

/** The banner on Hold detail once the merchant has responded, following the case. */
function afterSubmit(s) {
  const { deadlines: d, released } = agentView(s);
  if (released) return [`Hold lifted on ${fmtDate(d.releasedOn)}`, `${HOLD.amount} is added to your settlement on ${fmtDate(addDays(d.releasedOn, 1))}.`];
  if (d.escalatedOn) return ['Review requested', `You asked the District Grievance Officer for a review on ${fmtDate(d.escalatedOn)}. Your follow-up agent is watching Day 90.`];
  if (d.filedOn) return ['Filed on the national grievance portal', `The officer decides by ${fmtDate(d.officerDueOn)}. Your follow-up agent is watching every deadline.`];
  return ['Response submitted', `We file it on the national grievance portal by ${HOLD.respondBy} and tell you when the officer replies.`];
}

function hold(s) {
  const after = afterSubmit(s);
  const deadline = s.submitted
    ? `<div class="banner pos">${icon('checkCircle')}
         <p><strong>${after[0]}</strong><br>${after[1]}</p>
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
        <div class="summary-top"><span class="eyebrow">${holdState(s) === 'released' ? 'Released' : 'Amount on hold'}</span>${statusBadge(s)}</div>
        <p class="amount">${money(HOLD.amount)}</p>
        <p class="small muted">Order ${HOLD.order} · held from your settlement on ${HOLD.placedOn}</p>
      </section>
      ${deadline}
      <section class="card prose">
        <h3>What happened</h3>
        <p>Someone reported this payment as fraud on the national cyber-crime portal (1930). Police at ${HOLD.stationShort} have asked us to hold ${HOLD.amount} while they look into it. They haven't decided anything yet, and the money stays with us.</p>
        <h3>If you don't respond</h3>
        <p>For amounts under ₹50,000, police can return the money to the person who reported it, even without registering a case. <strong>That is how ${LEDGER.lost} went on two holds this year.</strong></p>
      </section>
      <div class="banner info">${icon('truck')}
        <p><strong>Delivered with OTP on 18 Sep</strong> · No refund or return on record. If the customer asked for an exchange, that chat is your strongest proof.</p>
      </div>
      <dl class="card facts">
        <div><dt>Reported on</dt><dd>${HOLD.reportedOn}</dd></div>
        <div><dt>Hold requested by</dt><dd>${HOLD.stationShort}</dd></div>
        <div><dt>Complaint acknowledgement no.</dt><dd class="mono-ink">${HOLD.complaintRef}</dd></div>
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
          <div><dt>Subject</dt><dd>Hold of ${HOLD.amount}, cyber-fraud report</dd></div>
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

export function sheetFrame(title) {
  return `
    <div class="sheet-scrim" data-action="sheet-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-head">
        <span class="grabber" aria-hidden="true"></span>
        <h2 id="sheet-title" tabindex="-1">${title}</h2>
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
        : esc(part).replace(/\b([A-Z]{2,}-\d+)\b/g, '<span class="nowrap">$1</span>');
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
      <p class="guard">${icon('shield', 18)}<span>AI writes only from your case file. It won't add facts or blame your customer. Tap a tag to see its proof.</span></p>
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

// ───────────── 10. Tracker and the follow-up agent ─────────────

const STATE_LABEL = { done: 'Done', now: 'In progress', next: 'Up next', missed: 'Deadline passed', faded: 'No longer needed' };
const ALL_TAGS = new Set(['E1', 'E2', 'E3', 'E4', 'E5']);

const SOURCE = {
  drafting: (model) => `<p class="source live"><span class="live-dot" aria-hidden="true"></span>Drafting live with ${model} · open model</p>`,
  live: (model) => `<p class="source live">${icon('checkCircle', 16)}Drafted live by ${model} · open model</p>`,
  scripted: () => `<p class="source scripted">${icon('file', 16)}Standard draft</p>`,
  edited: () => `<p class="source edited">${icon('edit', 16)}Edited by you</p>`,
};

/** The proposal the agent card shows: the one the merchant opened, else the first one not put off. */
export function focusedProposal(s) {
  if (!s.submitted) return null;
  const { proposals } = agentView(s);
  return proposals.find((p) => p.id === s.agentFocus) ?? proposals.find((p) => !p.snoozed) ?? null;
}

/** The call brief: fixed questions (chosen by the rules), answers and tip (written by AI or the template). */
function briefHtml(text, lang) {
  const copy = CALL_BRIEF[lang] ?? CALL_BRIEF.en;
  const parts = parseCallBrief(text, ALL_TAGS);
  if (!parts) return `<p>${esc(text).replace(/\n/g, '<br>')}</p>`;
  return `
    <div class="brief" lang="${lang}">
      <p class="brief-title">${icon('video', 18)}<span>${copy.title}</span></p>
      <p class="brief-keep">${copy.keep}</p>
      <p class="eyebrow">${copy.questionsLabel}</p>
      <ol class="brief-qs">
        ${copy.questions.map((q, i) => `<li><strong>${q}</strong><span>${withTags(parts[`a${i + 1}`])}</span></li>`).join('')}
      </ol>
      <p class="brief-tip">${icon('info', 18)}<span>${esc(parts.tip)}</span></p>
    </div>`;
}

/** The parts of the agent card that change while a draft streams, rendered separately. */
export function agentParts(s, p) {
  const job = s.agentJobs[p.id];
  const draft = s.agentDrafts[p.id];
  const editing = s.agentEditing === p.id;
  const sending = s.agentSending === p.id;
  const busy = Boolean(job) || editing || sending || !draft;
  const lang = draft?.lang ?? s.lang;

  const source = job ? SOURCE.drafting(job.model) : draft ? SOURCE[draft.source](draft.model) : '';
  let text = '';
  if (editing) {
    text = `<label class="sr-only" for="ag-edit">Edit the draft</label><textarea id="ag-edit" class="edit-area" spellcheck="true">${esc(draft.text)}</textarea>`;
  } else if (job && !job.text) {
    text = '<p class="drafting-note"><span class="spinner" aria-hidden="true"></span>Drafting from your case file…</p>';
  } else if (job) {
    text = p.type === 'call_brief' ? `<p>${esc(job.text).replace(/\n/g, '<br>')}<span class="caret" aria-hidden="true"></span></p>` : `<p>${withTags(job.text)}<span class="caret" aria-hidden="true"></span></p>`;
  } else if (draft) {
    text = p.type === 'call_brief' ? briefHtml(draft.text, lang) : `<p>${withTags(draft.text)}</p>`;
  }

  const off = busy ? ' disabled' : '';
  const primary = p.type === 'call_brief' ? `${icon('check', 18)}Got it` : `${icon('send', 18)}Approve and send`;
  const tools = editing
    ? `<button class="chip" type="button" data-action="agent-edit-done" data-arg="${p.id}">${icon('check', 16)}Done</button>`
    : `<button class="btn btn-primary agent-approve" type="button" data-action="agent-approve" data-arg="${p.id}"${off}>${sending ? '<span class="spinner" aria-hidden="true"></span>Sending…' : primary}</button>
       ${p.type === 'call_brief' ? '' : `<button class="chip" type="button" data-action="agent-edit" data-arg="${p.id}"${off}>${icon('edit', 16)}Edit</button>`}
       <button class="btn btn-text" type="button" data-action="agent-later" data-arg="${p.id}"${off}>Not now</button>`;
  return { source, text, tools, busy, lang };
}

const DUE = {
  officer_reply: (p) => `Reply by ${fmtDate(p.dueBy)}`,
  call_brief: () => 'Read it before the call',
  escalation: (p) => `Send by ${fmtDate(p.dueBy)}`,
  release_request: (p) => `Send by ${fmtDate(p.dueBy)}`,
};

function agentCard(s) {
  const view = agentView(s);
  const now = storyNow(s);
  const p = focusedProposal(s);
  const head = (cls, label) => `
    <div class="agent-head">
      <span class="agent-ic" aria-hidden="true">${icon('spark', 18)}</span>
      <h3 id="agent-h">Follow-up agent</h3>
      <span class="badge ${cls}">${label}</span>
    </div>`;
  const canDo = `<button class="link-btn" type="button" data-action="agent-sheet">${icon('shield', 16)}What the agent can do</button>`;

  if (p) {
    const parts = agentParts(s, p);
    const letter = AGENT_LETTERS[p.type]?.[parts.lang];
    const body = p.type === 'call_brief'
      ? `<div class="agent-brief" id="ag-text">${parts.text}</div>`
      : `<article class="letter agent-letter" lang="${parts.lang}" aria-label="Draft message">
           <p class="letter-to">${letter.to}</p>
           <p class="letter-re">${letter.re}</p>
           <div class="letter-text" id="ag-text" aria-busy="${parts.busy}">${parts.text}</div>
           <p class="letter-sign">${LETTER[parts.lang].sign}</p>
         </article>`;
    return `
      <section class="agent-card needs" aria-labelledby="agent-h">
        ${head('info', p.reminder ? 'Reminder · needs your OK' : 'Needs your OK')}
        <h4 class="agent-title">${AGENT_COPY[p.type].title}</h4>
        <p class="agent-why">${esc(p.why)}</p>
        <div id="ag-source">${parts.source}</div>
        ${body}
        <p class="agent-due">${icon('clock', 16)}${DUE[p.type](p)}${p.type === 'call_brief' ? '' : ' · nothing is sent until you approve'}</p>
        <div class="agent-tools" id="ag-tools">${parts.tools}</div>
        ${view.proposals.filter((x) => x.id !== p.id).map((x) => `
          <p class="agent-waiting">${icon('clock', 16)}<span>Also waiting: ${AGENT_COPY[x.type].title.toLowerCase()}</span>
            <button class="link-btn" type="button" data-action="agent-review" data-arg="${x.id}">Review</button>
          </p>`).join('')}
        ${canDo}
      </section>`;
  }

  const done = [...s.case.actions].reverse().find((a) => a.on === now && (a.status === 'sent' || a.status === 'acknowledged'));
  const waiting = view.proposals.filter((x) => x.snoozed);
  const doneLine = done
    ? `<p class="agent-done">${icon('checkCircle', 18)}<span>${done.status === 'acknowledged' ? 'Brief read' : `Sent to ${AGENT_COPY[done.type].sentTo}`} · ${fmtDate(done.on)}</span></p>`
    : '';
  const watching = view.released
    ? '<p class="agent-line">The hold is lifted. Nothing left to watch.</p>'
    : `<p class="agent-line">I'm watching ${view.watch.length} date${view.watch.length === 1 ? '' : 's'} for you</p>
       <ul class="watch">${view.watch.map((w) => `<li><span>${w.label}</span><strong>${fmtDate(w.on)}${w.time ? `, ${w.time}` : ''}</strong></li>`).join('')}</ul>`;
  return `
    <section class="agent-card" aria-labelledby="agent-h">
      ${head(done || view.released ? 'pos' : 'neutral', done || view.released ? 'Done' : 'Watching')}
      ${doneLine}
      ${watching}
      ${waiting.map((w) => `
        <p class="agent-waiting">${icon('clock', 16)}<span>Waiting for you: ${AGENT_COPY[w.type].title.toLowerCase()}</span>
          <button class="link-btn" type="button" data-action="agent-review" data-arg="${w.id}">Review</button>
        </p>`).join('')}
      ${canDo}
    </section>`;
}

const ACTORS = { agent: ['spark', 'Agent'], you: ['user', 'You'], officer: ['police', 'Officer'], system: ['send', 'Portal'] };

function activityLog(s) {
  const rows = activity(s.case, storyNow(s));
  return `
    <section aria-labelledby="log-h">
      <h3 class="sec-title" id="log-h">What your agent did</h3>
      <ol class="log">
        ${rows.map((r) => `
          <li class="log-row ${r.actor}">
            <span class="log-ic">${icon(ACTORS[r.actor][0], 15)}<span class="sr-only">${ACTORS[r.actor][1]}:</span></span>
            <span class="log-text">${esc(r.text)}</span>
            <time class="log-when">${fmtDate(r.on)}</time>
          </li>`).join('')}
      </ol>
    </section>`;
}

/** Body of the "What the agent can do" sheet. */
export function agentSheetBody() {
  const can = ['Watch your deadlines', 'Draft replies', 'Prepare call briefs'];
  const cant = ['Send anything without your OK', 'Contact your customer', 'Promise an outcome'];
  return `
    <p class="intro">After you submit, your follow-up agent keeps the case moving. Rules decide when to act, AI drafts the words, and you decide what is sent.</p>
    <h3 class="sheet-sub">Can</h3>
    <ul class="can-list">${can.map((t) => `<li>${icon('check', 18)}<span>${t}</span></li>`).join('')}</ul>
    <h3 class="sheet-sub">Can't</h3>
    <ul class="can-list cant">${cant.map((t) => `<li>${icon('close', 18)}<span>${t}</span></li>`).join('')}</ul>
    <div class="locked-toggle">
      <span class="lt-text"><strong>Send without asking</strong><span>Off in this version</span></span>
      <span class="switch" role="switch" aria-checked="false" aria-disabled="true" aria-label="Send without asking: off in this version">${icon('lock', 13)}</span>
    </div>`;
}

function tracker(s) {
  const ms = measuredMs(s);
  const now = storyNow(s);
  const { released } = agentView(s);
  const items = timeline(s.case, now, ms !== null ? inWords(ms) : null);
  const next = SCENARIOS[s.scenario][s.step + 1];
  return `
    ${appbar(`Hold · ${HOLD.order}`)}
    <div class="body">
      ${agentCard(s)}
      <section class="card summary" aria-label="Hold summary">
        <div class="summary-top"><span class="eyebrow">${released ? 'Released' : 'Amount on hold'}</span>${statusBadge(s)}</div>
        <p class="amount">${money(HOLD.amount)}</p>
        <p class="small muted with-ic">${icon('police', 16)}${HOLD.stationShort} · as of ${fmtDate(now)}</p>
      </section>
      <ol class="timeline" aria-label="Progress">
        ${items.map((item) => `
          <li class="tl ${item.state}">
            <span class="tl-mark" aria-hidden="true">${item.state === 'done' ? icon('check', 14) : item.state === 'missed' ? '!' : ''}</span>
            <div class="tl-body">
              <p class="tl-title">${item.title}<span class="sr-only"> (${STATE_LABEL[item.state]})</span></p>
              <p class="tl-when">${item.when}</p>
              ${item.text ? `<p class="tl-text">${item.text}</p>` : ''}
            </div>
          </li>`).join('')}
      </ol>
      ${activityLog(s)}
      ${next ? `<button class="demo-skip" type="button" data-action="advance">${icon('forward', 16)}Demo · Skip ahead to ${fmtDate(next.on)}</button>` : ''}
    </div>
    ${released
      ? '<footer class="footer"><button class="btn btn-primary btn-block" type="button" data-action="go" data-arg="outcome">See the result</button></footer>'
      : ''}`;
}

// ───────────── 11. Outcome ─────────────

function outcome(s) {
  const ms = measuredMs(s);
  const result = outcomeOf(s.case);
  const sent = s.case.actions.filter((a) => a.status === 'sent').length;
  return `
    <div class="body top-pad">
      <div class="success">
        <span class="success-check" aria-hidden="true">${icon('check', 40)}</span>
        <h2 tabindex="-1">Hold lifted</h2>
        <p class="amount ok-text">${money(HOLD.amount)}</p>
        ${result ? `<p>Back in your settlement on ${fmtDate(result.creditedOn)}.</p>` : ''}
      </div>
      <dl class="card facts">
        ${ms !== null ? `<div><dt>Your time on it</dt><dd>${inWords(ms)}</dd></div>` : ''}
        ${result ? `<div><dt>Days on hold</dt><dd>${result.days}</dd></div><div><dt>Released on</dt><dd>${fmtDate(result.releasedOn, { year: true })}</dd></div>` : ''}
        ${sent ? `<div><dt>Follow-ups sent with your OK</dt><dd>${sent}</dd></div>` : ''}
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
  const map = { lock: 1, home: 1, holds: 2, hold: 2, casefile: s.sheet?.kind === 'evidence' ? 4 : 3, statement: 5, review: 6, submitted: 7, tracker: 7, outcome: 7 };
  return map[s.screen] ?? 1;
}
