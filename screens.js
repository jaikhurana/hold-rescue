// One render function per screen. Each takes the app state and returns HTML.
// Rendering from state (rather than hand-written markup) keeps every badge, count and
// amount in step as the hold moves from "on hold" to "under review" to "released".
import { icon } from './icons.js';
import { HOLD, HOME, MERCHANT } from './case-data.js';

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
              <span class="row-main"><span class="row-title">${p.order}</span><br><span class="row-sub">${p.method} · ${p.time}</span></span>
              <span class="row-end">${p.amount}<span class="badge pos">Captured</span></span>
            </div>`)
            .join('')}
        </div>
      </section>
    </div>
    ${tabbar(s, 'home')}`;
}

// ───────────── Placeholder for screens built in later milestones ─────────────

function placeholder(title) {
  return () => `
    ${appbar(title)}
    <div class="body"><div class="card">This screen is built in a later milestone.</div></div>`;
}

export const SCREENS = {
  lock,
  home,
  holds: placeholder('Holds'),
  hold: placeholder('Payment on hold'),
  casefile: placeholder('Case file'),
  statement: placeholder('Your statement'),
  review: placeholder('Review and submit'),
  submitted: placeholder('Response submitted'),
  tracker: placeholder(`Hold · ${HOLD.order}`),
  outcome: placeholder('Hold lifted'),
};

/** Which presenter-rail step (1–7) a screen belongs to. */
export function stepOf(s) {
  const map = { lock: 1, home: 1, holds: 2, hold: 2, casefile: s.sheet ? 4 : 3, statement: 5, review: 6, submitted: 7, tracker: 7, outcome: 7 };
  return map[s.screen] ?? 1;
}
