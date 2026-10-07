// Hold Rescue · app state, navigation and demo controls.
// State lives in memory only; a reload restarts the demo.
import { addDays, evaluate, fmtDate, newCase, withAction, withEvents } from './agent.js';
import { AGENT_COPY, AGENT_TAGS, SCENARIOS, evidenceFor } from './case-data.js';
import { streamDraft } from './draft-client.js';
import {
  SCREENS, TONE, NOT_IN_PROTOTYPE, TAG_LABELS,
  agentParts, agentSheetBody, agentView, clock, currentDraft, draftKey, focusedProposal, pushBanner, sheetBody, sheetFrame, statementParts, stepOf, storyNow,
} from './screens.js';
import { cleanCallBrief, cleanDraft, scriptedAgentDraft, scriptedStatement, typedSlice, wordCount } from './statement.js';

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
  sheet: null, // open sheet: { kind: 'evidence', view: 'pick'|'reading'|'read'|'tag', url? } or { kind: 'agent' }
  e5: null, // null | { kind: 'chat' } | { kind: 'tag', tag }. Only this shape is ever sent to the server.
  upload: null, // { url } for a real image the merchant picked; stays in the browser as an object URL
  caseRevealed: false, // the case file staggers in only the first time
  justAdded: false, // animate the E5 card once after it is added
  lang: 'en', // statement language: 'en' | 'hi'
  variant: '', // '' | 'shorter'
  drafts: {}, // `${lang}|${variant}` → { text, source: 'live'|'scripted'|'edited', model? }
  drafting: null, // the draft in progress: { key, phase: 'waiting'|'streaming'|'typing', text, model, controller? }
  editing: false,
  callTime: 'mornings',
  declared: false,
  submitting: false,
  timer: { start: null, end: null }, // starts when Hold detail first opens, stops when Submit is tapped
  submitted: false,
  // After submitting: the story moves through the chosen scenario's steps (case-data.js), and the
  // follow-up agent's rules (agent.js) read the case to decide what to propose.
  step: 0,
  case: newCase(),
  agentDrafts: {}, // proposal id → { text, source: 'live'|'scripted'|'edited', model?, lang, announce? }
  agentJobs: {}, // proposal id → the draft in progress: { phase, text, model, controller }
  agentEditing: null, // proposal id being edited
  agentSending: null, // proposal id being "sent"
  agentFocus: null, // a put-off proposal the merchant chose to review
  scenario: 'responds', // presenter setting, kept across Restart: 'responds' | 'quiet'
  theme: 'light', // presenter setting, kept across Restart: light by default, like Razorpay's app
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
  if (name === 'tracker') prepareAgentDrafts();
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

function openSheet(kind = 'evidence') {
  sheetReturnFocus = document.activeElement;
  s.sheet = { kind };
  sheetRoot.innerHTML = sheetFrame(kind === 'agent' ? 'What the agent can do' : 'Add from your phone');
  sheetRoot.classList.add('open');
  currentScreen().inert = true;
  if (kind === 'agent') $('#sheet-body').innerHTML = agentSheetBody();
  else setSheetView('pick');
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

/** Sets E5 and clears any drafted statement, which no longer matches the case file. */
function setE5(e5, upload = null) {
  if (s.upload && s.upload.url !== upload?.url) URL.revokeObjectURL(s.upload.url);
  s.e5 = e5;
  s.upload = upload;
  cancelDraft();
  s.drafts = {};
  s.editing = false;
}

/** Adds E5 from the sheet and returns to the case file. */
function addE5(e5, upload = null) {
  setE5(e5, upload);
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
  if (!file || s.sheet?.kind !== 'evidence') return;
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

// ───────────── Submit, time and push banners ─────────────

let submitTimer = 0;
function submit() {
  if (!s.declared || s.submitting) return;
  s.timer.end ??= s.timer.start ? Date.now() : null;
  s.submitting = true;
  refresh();
  submitTimer = setTimeout(() => {
    s.submitting = false;
    markSubmitted();
    s.stack = ['home'];
    show('submitted');
  }, 1300);
}

let pushTimer = 0;
const pushLayer = $('#push-layer');

function showPush(push) {
  clearTimeout(pushTimer);
  pushLayer.innerHTML = pushBanner(push);
  pushTimer = setTimeout(hidePush, 7000);
}

function hidePush() {
  clearTimeout(pushTimer);
  const banner = pushLayer.firstElementChild;
  if (!banner) return;
  banner.classList.add('hiding');
  setTimeout(() => banner.remove(), reducedMotion.matches ? 0 : 220);
}

function markSubmitted() {
  s.submitted = true;
  s.step = 0;
  s.case = { ...newCase(), submittedOn: storyNow(s) };
}

/**
 * Moves the story to the next date in the chosen scenario. The agent's rules then decide what is due;
 * new proposals start drafting at once, and the banner says what changed.
 */
function advance() {
  const steps = SCENARIOS[s.scenario];
  if (!s.submitted || s.step >= steps.length - 1) return;
  const before = new Set(agentView(s).proposals.map((p) => p.id));
  s.step += 1;
  const step = steps[s.step];
  s.case = withEvents(s.case, step);
  const view = evaluate(s.case, step.on);
  const reminders = view.proposals.filter((p) => p.reminder);
  for (const p of reminders) s.case = withAction(s.case, p, 'reminded', step.on);
  const added = view.proposals.filter((p) => !before.has(p.id));
  s.agentFocus = null;
  prepareAgentDrafts();

  let push = step.push ?? null;
  if (view.released) push = { title: 'Hold lifted: ₹1,800 is yours', body: `It will be added to your settlement on ${fmtDate(addDays(step.on, 1))}.`, open: 'outcome' };
  else if (added.length) {
    const also = reminders.length ? ` Also still waiting: ${AGENT_COPY[reminders[0].type].title.toLowerCase()}.` : '';
    push = { ...AGENT_COPY[added[0].type].push, open: 'tracker' };
    push.body += also;
  }
  else if (reminders.length) push = { title: `Reminder: ${AGENT_COPY[reminders[0].type].ready.toLowerCase()}`, body: 'Tap to review.', open: 'tracker' };
  if (s.screen !== 'lock') refresh();
  if (push) showPush(push);
  syncRail();
}

// ───────────── Follow-up agent: drafting and approval ─────────────

/** The proofs a proposal may cite: in the case file, and allowed by its sentence plan. */
const agentValidIds = (type) => new Set(evidenceFor(s.e5).map((e) => e.id).filter((id) => AGENT_TAGS[type].includes(id)));

/** Starts a draft for every waiting proposal that doesn't have one yet. */
function prepareAgentDrafts() {
  if (!s.submitted) return;
  for (const p of agentView(s).proposals) {
    if (!s.agentDrafts[p.id] && !s.agentJobs[p.id]) startAgentDraft(p);
  }
  const p = focusedProposal(s);
  const draft = p && s.agentDrafts[p.id];
  if (draft?.announce && s.screen === 'tracker') {
    toast(draft.announce);
    draft.announce = null;
  }
}

function startAgentDraft(p) {
  const lang = s.lang; // the agent writes in the statement's language
  const valid = agentValidIds(p.type);
  const fallback = (message) => {
    delete s.agentJobs[p.id];
    s.agentDrafts[p.id] = { text: scriptedAgentDraft(p.type, lang, s.e5), source: 'scripted', lang, announce: message };
    if (message && s.screen === 'tracker' && focusedProposal(s)?.id === p.id) {
      toast(message);
      s.agentDrafts[p.id].announce = null;
    }
    updateAgent();
  };
  if (s.aiMode === 'scripted') return fallback(null);

  const job = { phase: 'waiting', text: '', model: s.health.model, controller: new AbortController() };
  s.agentJobs[p.id] = job;
  updateAgent();
  streamDraft({ kind: p.type, lang, variant: '', fresh: false, e5: s.e5 }, {
    signal: job.controller.signal,
    onText(raw, model) {
      if (s.agentJobs[p.id] !== job) return;
      job.phase = 'streaming';
      job.model = model;
      job.text = p.type === 'call_brief' ? raw : cleanDraft(raw, valid);
      updateAgent();
    },
  })
    .then((result) => {
      if (s.agentJobs[p.id] !== job) return;
      const text = p.type === 'call_brief' ? cleanCallBrief(result.text, valid) : cleanDraft(result.text, valid);
      if (!text) throw new Error('bad_shape');
      if (p.type !== 'call_brief' && wordCount(text) < 15) throw new Error('too_short');
      if (!/\[E\d\]/.test(text)) throw new Error('no_tags'); // every message must point to its proof
      delete s.agentJobs[p.id];
      s.agentDrafts[p.id] = { text, source: 'live', model: result.model, lang };
      updateAgent();
    })
    .catch((err) => {
      if (s.agentJobs[p.id] !== job) return;
      fallback(err?.message === 'no_tags' || err?.message === 'bad_shape'
        ? "The open model's draft didn't cite its proof, so this is the standard draft."
        : 'The open model did not answer, so this is the standard draft.');
    });
}

function cancelAgentDrafts() {
  for (const job of Object.values(s.agentJobs)) job.controller?.abort();
  s.agentJobs = {};
}

let agentSig = '';
/** Updates the agent card. Streaming text only touches the text, so buttons are never swapped mid-tap. */
function updateAgent() {
  if (s.screen !== 'tracker') return;
  const p = focusedProposal(s);
  const el = currentScreen();
  if (!p || !$('#ag-text', el)) return refresh();
  const parts = agentParts(s, p);
  const sig = `${p.id}|${parts.tools}|${Boolean(s.agentJobs[p.id])}`;
  if (sig !== agentSig) {
    agentSig = sig;
    refresh();
    return;
  }
  $('#ag-text', el).innerHTML = parts.text;
  $('#ag-source', el).innerHTML = parts.source;
}

/** The merchant's OK: "sends" the message (simulated), or marks the call brief as read. */
function approveProposal(id) {
  const p = agentView(s).proposals.find((x) => x.id === id);
  if (!p || !s.agentDrafts[id] || s.agentSending) return;
  const now = storyNow(s);
  if (p.type === 'call_brief') {
    s.case = withAction(s.case, p, 'acknowledged', now);
    s.agentFocus = null;
    refresh();
    toast('Good luck with the call. Your agent will remind you 30 minutes before.');
    return;
  }
  s.agentSending = id;
  refresh();
  setTimeout(() => {
    s.agentSending = null;
    s.case = withAction(s.case, p, 'sent', now, { edited: s.agentDrafts[id].source === 'edited' });
    s.agentFocus = null;
    refresh();
    toast(`Sent to ${AGENT_COPY[p.type].sentTo}.`);
    syncRail();
  }, 900);
}

// ───────────── Presenter rail ─────────────

const timerValue = $('#timer-value');
const timerFill = $('#timer-fill');
const timerCard = $('.timer-card');
const advanceBtn = $('#advance');

function syncTimer() {
  const ms = s.timer.start ? (s.timer.end ?? Date.now()) - s.timer.start : 0;
  timerValue.textContent = clock(ms);
  timerFill.style.width = `${Math.min(ms / 120_000, 1) * 100}%`;
  timerCard.classList.toggle('over', ms > 120_000);
}
setInterval(() => {
  if (s.timer.start && !s.timer.end) syncTimer();
}, 250);

function syncRail() {
  const step = stepOf(s);
  rail.querySelectorAll('[data-action="jump"]').forEach((btn) => {
    const n = Number(btn.dataset.arg);
    btn.classList.toggle('done', n < step);
    if (n === step) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
  });
  const next = SCENARIOS[s.scenario][s.step + 1];
  advanceBtn.disabled = !s.submitted || !next;
  advanceBtn.textContent = !s.submitted ? 'Advance time' : next ? `Advance to ${fmtDate(next.on)}` : 'Hold released';
  rail.querySelectorAll('[data-action="scenario"]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.arg === s.scenario)));
  syncTimer();
}

/** Light by default whatever the device setting; dark only when the presenter picks it. */
function syncTheme() {
  document.documentElement.dataset.theme = s.theme;
  $('meta[name="theme-color"]').content = s.theme === 'dark' ? '#131517' : '#F5F6F8';
  rail.querySelectorAll('[data-action="theme"]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.arg === s.theme)));
}

const aiCard = $('.ai-card');
const aiStatus = $('#ai-status-text');

function syncAi() {
  rail.querySelectorAll('[data-action="ai-mode"]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.arg === s.aiMode)));
  let state;
  let text;
  if (s.aiMode === 'scripted') {
    state = 'scripted';
    text = 'Scripted: instant and the same every time. Best for recording.';
  } else if (s.health.ai === true) {
    state = 'live';
    text = `Live: ${s.health.model}, an open model running on Groq, drafts the statement and the agent's messages. Free, no login.`;
  } else if (s.health.ai === false) {
    state = 'missing';
    text = "Open model not connected yet: add GROQ_API_KEY under Vercel's Environment Variables, then redeploy. Until then, drafts use the scripted text.";
  } else {
    state = 'checking';
    text = 'Checking the open model…';
  }
  aiCard.dataset.state = state;
  aiStatus.textContent = text;
}

/** Jumps to a demo step, filling in whatever the earlier steps would have produced. */
function jump(step) {
  closeRail({ restoreFocus: false });
  closeSheet({ restoreFocus: false });
  hidePush();
  if (step >= 5 && !s.e5) setE5({ kind: 'chat' });
  if (step >= 6) ensureDraft();
  if (step >= 7 && !s.submitted) {
    clearTimeout(submitTimer);
    s.submitting = false;
    s.declared = true;
    s.timer.end ??= s.timer.start ? Date.now() : null;
    markSubmitted();
  }
  const routes = {
    1: [[], 'lock'],
    2: [['home'], 'hold'],
    3: [['home', 'hold'], 'casefile'],
    4: [['home', 'hold'], 'casefile'],
    5: [['home', 'hold', 'casefile'], 'statement'],
    6: [['home', 'hold', 'casefile', 'statement'], 'review'],
    7: [['home'], 'tracker'],
  };
  const [stack, screen] = routes[step];
  s.stack = [...stack];
  show(screen, 'fade');
  if (step === 4) openSheet();
}

/** Back to the lock screen with a clean slate. The drafting mode and model status are kept. */
function restart() {
  cancelDraft();
  cancelAgentDrafts();
  clearTimeout(submitTimer);
  closeRail({ restoreFocus: false });
  closeSheet({ restoreFocus: false });
  hidePush();
  if (s.upload) URL.revokeObjectURL(s.upload.url);
  s = { ...initialState(), aiMode: s.aiMode, health: s.health, scenario: s.scenario, theme: s.theme };
  show('lock', 'fade');
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

  'call-time'(id) {
    s.callTime = id;
    refresh();
  },
  submit,
  track() {
    s.stack = ['home'];
    show('tracker');
  },
  advance,
  'push-open'(target) {
    hidePush();
    if (s.screen !== target) go(target);
  },
  done: () => goTab('holds'),

  // Follow-up agent
  'agent-approve': approveProposal,
  'agent-edit'(id) {
    if (!s.agentDrafts[id] || s.agentJobs[id]) return;
    s.agentEditing = id;
    refresh();
    $('#ag-edit')?.focus();
  },
  'agent-edit-done'(id) {
    const p = agentView(s).proposals.find((x) => x.id === id);
    const draft = s.agentDrafts[id];
    const text = p && cleanDraft($('#ag-edit')?.value ?? '', agentValidIds(p.type));
    if (!text) toast("The message can't be empty, so the last version is kept.");
    else if (text !== draft.text) s.agentDrafts[id] = { ...draft, text, source: 'edited' };
    s.agentEditing = null;
    refresh();
  },
  'agent-later'(id) {
    const p = agentView(s).proposals.find((x) => x.id === id);
    if (!p) return;
    s.case = withAction(s.case, p, 'snoozed', storyNow(s));
    s.agentFocus = null;
    refresh();
    toast('Kept for later. Your agent will remind you at the next update.');
  },
  'agent-review'(id) {
    s.agentFocus = id;
    refresh();
    currentScreen().querySelector('.agent-card')?.scrollIntoView({ block: 'start' });
  },
  'agent-sheet': () => openSheet('agent'),

  // Presenter rail
  jump: (step) => jump(Number(step)),
  restart,
  scenario(name) {
    if (!SCENARIOS[name] || name === s.scenario) return;
    s.scenario = name;
    if (s.submitted) {
      // Start the story after submitting again, now with the other officer.
      cancelAgentDrafts();
      s.step = 0;
      s.case = { ...newCase(), submittedOn: s.case.submittedOn };
      s.agentDrafts = {};
      s.agentFocus = null;
      s.agentEditing = null;
      hidePush();
      refresh();
      toast(name === 'quiet' ? 'Scenario: the officer goes quiet.' : 'Scenario: the officer responds.');
    }
    syncRail();
  },
  theme(name) {
    s.theme = name === 'dark' ? 'dark' : 'light';
    syncTheme();
  },
  'ai-mode'(mode) {
    s.aiMode = mode === 'scripted' ? 'scripted' : 'live';
    syncAi();
  },
  'rail-open': openRail,
  'rail-close': () => closeRail(),
};

const changes = {
  declare(el) {
    s.declared = el.checked;
    $('#submit').disabled = !s.declared || s.submitting;
  },
};

document.addEventListener('change', (event) => {
  const el = event.target.closest('[data-change]');
  if (el) changes[el.dataset.change]?.(el);
});

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
syncTheme();

syncAi();
fetch('/api/health')
  .then((res) => (res.ok ? res.json() : null))
  .then((health) => {
    s.health = health ? { ai: Boolean(health.ai), model: String(health.model || 'gpt-oss-120b') } : { ...s.health, ai: false };
  })
  .catch(() => {
    s.health = { ...s.health, ai: false };
  })
  .finally(syncAi);

// Exposed for debugging in the browser console only.
window.holdRescue = { get state() { return s; }, refresh };
