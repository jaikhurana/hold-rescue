// Hold Rescue · app state, navigation and demo controls.
// State lives in memory only; a reload restarts the demo.
import { SCREENS, TONE, NOT_IN_PROTOTYPE, stepOf } from './screens.js';

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
  sheet: null, // open bottom sheet inside the phone, if any
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
  syncRail();
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
});

// ───────────── Start ─────────────

show('lock', 'none', { focus: false });

// Exposed for debugging in the browser console only.
window.holdRescue = { get state() { return s; }, refresh };
