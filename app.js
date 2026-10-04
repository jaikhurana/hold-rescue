// Hold Rescue · app state, navigation and demo controls.
// State lives in memory only; a reload restarts the demo.
import { evidenceFor } from './case-data.js';
import { streamDraft } from './draft-client.js';
import { SCREENS, TONE, NOT_IN_PROTOTYPE, TAG_LABELS, currentDraft, draftKey, sheetBody, sheetFrame, statementParts, stepOf } from './screens.js';
import { cleanDraft, scriptedStatement, typedSlice, wordCount } from './statement.js';

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
  lang: 'en', // statement language: 'en' | 'hi'
  variant: '', // '' | 'shorter'
  drafts: {}, // `${lang}|${variant}` → { text, source: 'live'|'scripted'|'edited', model? }
  drafting: null, // the draft in progress: { key, phase: 'waiting'|'streaming'|'typing', text, model, controller? }
  editing: false,
  timer: { start: null, end: null },
  submitted: false,
  stage: 0, // 0 submitted · 1 filed · 2 call booked · 3 released
  // Presenter settings, kept across Restart:
  aiMode: 'live', // 'live' | 'scripted'
  health: { ai: null, model: 'gpt-oss-120b' },
});

let s = initialState();
const TYPEWRITER_MS = 2300;

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
  if (name === 'statement' && !currentDraft(s) && !s.drafting) startDraft();
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
  cancelDraft();
  s.drafts = {};
  s.editing = false;
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

// ───────────── Drafting the statement ─────────────

const validIds = () => new Set(evidenceFor(s.e5).map((item) => item.id));

/** Drafts the statement for the current language and length: live from the open model, or scripted. */
function startDraft({ fresh = false } = {}) {
  cancelDraft();
  const key = draftKey(s);
  if (s.aiMode === 'scripted') return typeScripted(key);

  const job = { key, phase: 'waiting', text: '', model: s.health.model, controller: new AbortController(), stopped: false };
  s.drafting = job;
  updateStatement();
  const valid = validIds();
  // Exactly the four fields the server accepts. e5 is null, { kind: 'chat' } or { kind: 'tag', tag }.
  const params = { lang: s.lang, variant: s.variant, fresh, e5: s.e5 };

  streamDraft(params, {
    signal: job.controller.signal,
    onText(raw, model) {
      if (s.drafting !== job) return;
      job.phase = 'streaming';
      job.model = model;
      job.text = cleanDraft(raw, valid);
      updateStatement();
    },
  })
    .then((result) => {
      if (s.drafting !== job) return;
      const text = cleanDraft(result.text, valid);
      if (wordCount(text) < 20) throw new Error('too_short');
      // Guardrail: every statement must point the officer to its proof.
      if (!/\[E\d\]/.test(text)) throw new Error('no_tags');
      finishDraft(key, { text, source: 'live', model: result.model });
    })
    .catch((err) => {
      if (s.drafting !== job) return; // replaced by a newer draft, a language switch or a restart
      if (job.stopped && wordCount(job.text) >= 20) return finishDraft(key, { text: job.text, source: 'live', model: job.model });
      let message = 'The open model did not answer, so this is the standard draft.';
      if (job.stopped) message = 'Stopped, so this is the standard draft.';
      else if (err?.message === 'no_tags') message = "The open model's draft didn't cite its proof, so this is the standard draft.";
      typeScripted(key, message);
    });
}

function finishDraft(key, draft) {
  s.drafts[key] = draft;
  s.drafting = null;
  updateStatement();
}

/** Types out the scripted statement in about 2.3 s (instantly with reduced motion). */
function typeScripted(key, toastMessage) {
  const [lang, variant] = key.split('|');
  const full = scriptedStatement(lang, variant, s.e5);
  const job = { key, phase: 'typing', text: '' };
  s.drafting = job;
  if (toastMessage) toast(toastMessage);
  if (reducedMotion.matches) return finishDraft(key, { text: full, source: 'scripted' });
  const started = performance.now();
  // A timer rather than requestAnimationFrame, so the draft still finishes if the tab is in the background.
  const step = () => {
    if (s.drafting !== job) return;
    const n = Math.min(full.length, Math.ceil((full.length * (performance.now() - started)) / TYPEWRITER_MS));
    if (n >= full.length) return finishDraft(key, { text: full, source: 'scripted' });
    job.text = typedSlice(full, n);
    updateStatement();
    setTimeout(step, 30);
  };
  updateStatement();
  setTimeout(step, 30);
}

function cancelDraft() {
  s.drafting?.controller?.abort();
  s.drafting = null;
}

/** For demo jumps past the drafting step: use the scripted statement if there is no draft yet. */
function ensureDraft() {
  cancelDraft();
  s.editing = false;
  const key = draftKey(s);
  s.drafts[key] ??= { text: scriptedStatement(s.lang, s.variant, s.e5), source: 'scripted' };
}

let statementSig = '';
/** Updates the statement screen. Streaming text only touches the text, so buttons are never swapped mid-tap. */
function updateStatement() {
  if (s.screen !== 'statement') return;
  const el = currentScreen();
  const parts = statementParts(s);
  const sig = `${parts.tools}|${parts.busy}`;
  if (sig !== statementSig) {
    statementSig = sig;
    refresh();
    return;
  }
  $('#st-text', el).innerHTML = parts.text;
  $('#st-source', el).innerHTML = parts.source;
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
  proof(id) {
    const item = evidenceFor(s.e5).find((e) => e.id === id);
    if (item) toast(`${id} · ${item.title}: ${item.shown ?? `“${item.quote}”`}`);
  },
  lang(lang) {
    if (lang === s.lang || s.editing) return;
    cancelDraft(); // switching language while drafting cancels that draft
    s.lang = lang === 'hi' ? 'hi' : 'en';
    refresh();
    if (!currentDraft(s)) startDraft();
  },
  shorter() {
    s.variant = s.variant ? '' : 'shorter';
    refresh();
    if (!currentDraft(s)) startDraft();
  },
  redraft: () => startDraft({ fresh: true }),
  stop() {
    if (!s.drafting?.controller) return;
    s.drafting.stopped = true;
    s.drafting.controller.abort();
  },
  edit() {
    if (!currentDraft(s) || s.drafting) return;
    s.editing = true;
    refresh();
    $('#st-edit')?.focus();
  },
  'edit-done'() {
    const draft = currentDraft(s);
    const text = cleanDraft($('#st-edit')?.value ?? '', validIds());
    if (!text) toast("Your statement can't be empty, so the last version is kept.");
    else if (text !== draft.text) s.drafts[draftKey(s)] = { ...draft, text, source: 'edited' };
    s.editing = false;
    refresh();
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

fetch('/api/health')
  .then((res) => (res.ok ? res.json() : null))
  .then((health) => {
    if (health) s.health = { ai: Boolean(health.ai), model: String(health.model || 'gpt-oss-120b') };
  })
  .catch(() => {});

// Exposed for debugging in the browser console only.
window.holdRescue = { get state() { return s; }, refresh };
