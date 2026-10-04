// Hold Rescue · app state, navigation and demo controls.
// State lives in memory only; a reload restarts the demo.
import { SCREENS, TONE, NOT_IN_PROTOTYPE, TAG_LABELS, sheetBody, sheetFrame, stepOf } from './screens.js';

const $ = (sel, root = document) => root.querySelector(sel);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const phoneLayout = matchMedia('(max-width: 820px)');

const phone = $('#phone');
const viewport = $('#viewport');
const rail = $('#rail');
const railScrim = $('#rail-scrim');
const demoPill = $('.demo-pill');

const initialState = () => ({
  screen: 'lock',
  stack: [], // back stack of screen names
  sheet: null, // evidence sheet: { view: 'pick'|'reading'|'read'|'tag', url? }
  e5: null, // null | { kind: 'chat' } | { kind: 'tag', tag }. Only this shape is ever sent to the server.
  upload: null, // { url } for a real image the merchant picked; stays in the browser as an object URL
  caseRevealed: false, // the case file staggers in only the first time
  justAdded: false, // animate the E5 card once after it is added
  timer: { start: null, end: null },
  submitted: false,
  stage: 0, // 0 submitted · 1 filed · 2 call booked · 3 released
});

let s = initialState();

// ───────────── Navigation ─────────────

const currentScreen = () => viewport.querySelector('.screen:not(.leaving)');

/** Renders `name` as the current screen. `how`: 'fwd' | 'back' | 'fade' | 'none'. */
function show(name, how = 'fwd', { focus = true } = {}) {
  s.screen = name;
  const el = document.createElement('section');
  el.className = 'screen';
  el.dataset.screen = name;
  el.innerHTML = SCREENS[name](s);
  phone.dataset.tone = TONE[name] ?? 'on-light';

  viewport.querySelectorAll('.screen.leaving').forEach((n) => n.remove());
  const old = currentScreen();
  if (old) {
    if (how === 'none' || reducedMotion.matches) {
      old.remove();
    } else {
      old.classList.add('leaving');
      old.inert = true;
      setTimeout(() => old.remove(), 320);
      el.classList.add(`enter-${how}`);
    }
  }
  viewport.append(el);
  if (focus) el.querySelector('h2[tabindex]')?.focus({ preventScroll: true });
  afterShow(name);
  syncRail();
}

/** One-time effects when a screen appears. */
function afterShow(name) {
  if (name === 'hold' && !s.timer.start) s.timer.start = Date.now();
  if (name === 'casefile') s.caseRevealed = true;
}

function go(name) {
  s.stack.push(s.screen);
  show(name, 'fwd');
}

function back() {
  show(s.stack.pop() ?? 'home', 'back');
}

function goTab(name) {
  s.stack = [];
  show(name, 'fade');
}

/** Re-renders the current screen in place, keeping scroll position and focus. */
function refresh() {
  const el = currentScreen();
  if (!el) return;
  const scroller = el.querySelector('.body');
  const top = scroller?.scrollTop ?? 0;
  const active = document.activeElement;
  const key = el.contains(active) && active.dataset?.action ? `[data-action="${active.dataset.action}"]${active.dataset.arg ? `[data-arg="${active.dataset.arg}"]` : ''}` : null;
  el.innerHTML = SCREENS[s.screen](s);
  const nextScroller = el.querySelector('.body');
  if (nextScroller) nextScroller.scrollTop = top;
  if (key) el.querySelector(key)?.focus({ preventScroll: true });
  syncRail();
}

// ───────────── Toast ─────────────

let toastTimer = 0;
function toast(message) {
  const t = $('#toast');
  const bar = currentScreen()?.querySelector('.footer, .tabbar');
  const bottom = s.sheet ? 16 : (bar?.offsetHeight ?? 0) + 12;
  t.style.setProperty('--toast-bottom', `${bottom}px`);
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ───────────── Evidence sheet ("Add from your phone") ─────────────

const sheetRoot = $('#sheet-root');
const fileInput = $('#file-input');
let sheetReturnFocus = null;
let readTimer = 0;

function openSheet() {
  sheetReturnFocus = document.activeElement;
  s.sheet = { view: 'pick' };
  sheetRoot.innerHTML = sheetFrame();
  sheetRoot.classList.add('open');
  currentScreen().inert = true;
  setSheetView('pick');
  $('#sheet-title').focus({ preventScroll: true });
  syncRail();
}

function setSheetView(view, extra = {}) {
  clearTimeout(readTimer);
  s.sheet = { ...s.sheet, view, ...extra };
  $('#sheet-body').innerHTML = sheetBody(s);
  $('#sheet-body').scrollTop = 0;
  if (view === 'reading') readTimer = setTimeout(() => setSheetView('read'), 1500);
}

function closeSheet({ restoreFocus = true } = {}) {
  if (!s.sheet) return;
  clearTimeout(readTimer);
  if (s.sheet.url && s.sheet.url !== s.upload?.url) URL.revokeObjectURL(s.sheet.url);
  s.sheet = null;
  sheetRoot.classList.remove('open');
  sheetRoot.innerHTML = '';
  const screen = currentScreen();
  if (screen) screen.inert = false;
  if (restoreFocus && sheetReturnFocus?.isConnected) sheetReturnFocus.focus({ preventScroll: true });
  syncRail();
}

/** Sets E5, clears any drafted statement (it no longer matches the case file) and returns to the file. */
function addE5(e5, upload = null) {
  if (s.upload && s.upload.url !== upload?.url) URL.revokeObjectURL(s.upload.url);
  s.e5 = e5;
  s.upload = upload;
  s.justAdded = true;
  closeSheet({ restoreFocus: false });
  refresh();
  s.justAdded = false;
  currentScreen().querySelector('[data-action="go"]')?.focus({ preventScroll: true });
  toast('Added to your case file');
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file || !s.sheet) return;
  if (!file.type.startsWith('image/')) {
    toast('Pick an image, like a screenshot.');
    return;
  }
  if (s.sheet.url && s.sheet.url !== s.upload?.url) URL.revokeObjectURL(s.sheet.url);
  setSheetView('tag', { url: URL.createObjectURL(file) });
});

// ───────────── Presenter rail ─────────────

function syncRail() {
  const step = stepOf(s);
  rail.querySelectorAll('[data-action="jump"]').forEach((btn) => {
    const n = Number(btn.dataset.arg);
    btn.classList.toggle('done', n < step);
    if (n === step) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
  });
}

function openRail() {
  rail.classList.add('open');
  railScrim.hidden = false;
  demoPill.setAttribute('aria-expanded', 'true');
  $('.device').inert = true;
  $('[data-action="rail-close"]', rail).focus();
}

function closeRail({ restoreFocus = true } = {}) {
  if (!rail.classList.contains('open')) return;
  rail.classList.remove('open');
  railScrim.hidden = true;
  demoPill.setAttribute('aria-expanded', 'false');
  $('.device').inert = false;
  if (restoreFocus) demoPill.focus();
}

phoneLayout.addEventListener('change', () => closeRail({ restoreFocus: false }));

// ───────────── Actions (every [data-action] in the page) ─────────────

const actions = {
  back,
  na: () => toast(NOT_IN_PROTOTYPE),
  tab(name) {
    if (name === 'home' || name === 'holds') goTab(name);
    else toast(NOT_IN_PROTOTYPE);
  },
  'open-alert'() {
    // From the lock screen: open the hold with Home behind it in the back stack.
    s.stack = ['home'];
    show('hold', 'fwd');
  },
  'open-hold'() {
    go(s.submitted ? 'tracker' : 'hold');
  },
  go: (name) => go(name),

  'sheet-open': openSheet,
  'sheet-close': () => closeSheet(),
  'sheet-view': (view) => setSheetView(view),
  sample(which) {
    if (which === 'chat') setSheetView('reading');
    else if (which === 'photo') toast('That photo shows the product, not the conversation. Pick the chat.');
    else toast('That shows the payment, which is already in your file as E1.');
  },
  'add-chat': () => addE5({ kind: 'chat' }),
  'pick-file': () => fileInput.click(),
  'add-tag'(index) {
    const tag = TAG_LABELS[Number(index)];
    if (tag && s.sheet?.url) addE5({ kind: 'tag', tag }, { url: s.sheet.url });
  },
  'rail-open': openRail,
  'rail-close': () => closeRail(),
};

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  actions[el.dataset.action]?.(el.dataset.arg, el, event);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (rail.classList.contains('open')) closeRail();
  else if (s.sheet) closeSheet();
});

// ───────────── Start ─────────────

show('lock', 'none', { focus: false });

// Exposed for debugging in the browser console only.
window.holdRescue = { get state() { return s; }, refresh };
