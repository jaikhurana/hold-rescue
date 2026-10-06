// The follow-up agent's rules. Pure functions: a case and a date go in; deadlines, proposals,
// the watch list, the activity log and the timeline come out. No DOM and no network.
//
// Rules decide WHEN to act: every legal deadline is plain date arithmetic, never the model.
// AI decides only WHAT to say (api/draft.js). The merchant decides WHETHER anything is sent.
//
// A case is { holdOn, submittedOn, events, actions }, all dates ISO (YYYY-MM-DD):
//   events  — what happened outside the app: filed · officer_request · call_booked (callOn, callTime) · released
//   actions — the merchant's choices, append-only, in order: sent · acknowledged · snoozed · reminded
import { AGENT_COPY, AGENT_FACTS } from './case-data.js';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BY_VIDEO = 'Usually by video call, so you won’t need to travel to Lucknow.';

// ───────────── Dates ─────────────

const time = (iso) => Date.parse(`${iso}T00:00:00Z`);

/** addDays('2026-10-06', 15) → '2026-10-21' */
export function addDays(iso, days) {
  return new Date(time(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** daysBetween('2026-10-05', '2026-10-16') → 11 */
export function daysBetween(from, to) {
  return Math.round((time(to) - time(from)) / DAY_MS);
}

/** '2026-10-21' → 'Wed 21 Oct'. The year is shown outside 2026, or always with { year: true }. */
export function fmtDate(iso, { year = false } = {}) {
  const d = new Date(time(iso));
  const y = d.getUTCFullYear();
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year || y !== 2026 ? ` ${y}` : ''}`;
}

// ───────────── Case helpers (each returns a new case; nothing is mutated) ─────────────

export function newCase(holdOn = AGENT_FACTS.holdOn) {
  return { holdOn, submittedOn: null, events: [], actions: [] };
}

/** Adds a scenario step's events, dated to that step. */
export function withEvents(c, step) {
  return { ...c, events: [...c.events, ...(step.events ?? []).map((e) => ({ ...e, on: step.on }))] };
}

/** Records the merchant's choice on a proposal: 'sent' | 'acknowledged' | 'snoozed' | 'reminded'. */
export function withAction(c, proposal, status, on, extra = {}) {
  return { ...c, actions: [...c.actions, { id: proposal.id, type: proposal.type, status, on, ...extra }] };
}

const happened = (c, now) => c.events.filter((e) => e.on <= now); // ISO dates compare as strings
const firstEvent = (events, type) => events.find((e) => e.type === type) ?? null;
const latestAction = (c, id, now) => c.actions.filter((a) => a.id === id && a.on <= now).at(-1) ?? null;
const sentAction = (c, type, now) => c.actions.find((a) => a.type === type && a.status === 'sent' && a.on <= now) ?? null;

// ───────────── Deadlines ─────────────

/** Every date the law sets, computed from what has happened so far. */
export function deadlines(c, now) {
  const events = happened(c, now);
  const filedOn = firstEvent(events, 'filed')?.on ?? null;
  const escalatedOn = sentAction(c, 'escalation', now)?.on ?? null;
  return {
    fileBy: c.submittedOn ? addDays(c.submittedOn, 7) : null, // the platform files within 7 days
    filedOn,
    officerDueOn: filedOn ? addDays(filedOn, 15) : null, // the officer decides within 15 days of filing
    escalatedOn,
    dgoDueOn: escalatedOn ? addDays(escalatedOn, 15) : null, // then the District Grievance Officer, 15 more
    day75: addDays(c.holdOn, 75),
    day90: addDays(c.holdOn, 90), // a contested hold lapses unless police get an order to extend it
    releasedOn: firstEvent(events, 'released')?.on ?? null,
  };
}

/** Everything the rules call for up to `now`, whatever the merchant has done about it. */
function triggered(c, now, d) {
  if (!c.submittedOn) return [];
  const out = [];
  const before = (on) => !(d.releasedOn && d.releasedOn < on);
  for (const e of happened(c, now)) {
    if (e.type === 'officer_request') {
      out.push({ id: `officer_reply@${e.on}`, type: 'officer_reply', on: e.on, dueBy: addDays(e.on, 1), why: `The officer asked on ${fmtDate(e.on)}: “${AGENT_FACTS.officerRequest}”` });
    }
    if (e.type === 'call_booked') {
      out.push({ id: `call_brief@${e.callOn}`, type: 'call_brief', on: e.on, dueBy: e.callOn, why: `A video call with the officer is booked for ${fmtDate(e.callOn)}, ${e.callTime}.` });
    }
  }
  if (d.officerDueOn) {
    const on = addDays(d.officerDueOn, 1);
    if (on <= now && before(on)) {
      out.push({ id: 'escalation', type: 'escalation', on, dueBy: on, why: `The officer's 15 days ended on ${fmtDate(d.officerDueOn)} with no decision.` });
    }
  }
  if (d.day90 <= now && before(d.day90)) {
    out.push({ id: 'release_request', type: 'release_request', on: d.day90, dueBy: addDays(d.day90, 1), why: `Day 90 was ${fmtDate(d.day90)}, and there is no order to continue the hold.` });
  }
  return out;
}

// ───────────── The agent's view ─────────────

/**
 * case + date → { deadlines, released, proposals, watch, notices }.
 * A proposal is waiting until the merchant sends (or, for the call brief, reads) it.
 * "Not now" keeps it, hidden (`snoozed`) until the date moves on; then it comes back as a `reminder`.
 * Once the hold is lifted, nothing is proposed.
 */
export function evaluate(c, now) {
  const d = deadlines(c, now);
  const released = Boolean(d.releasedOn);
  const proposals = [];
  if (!released) {
    for (const p of triggered(c, now, d)) {
      const last = latestAction(c, p.id, now);
      if (last && (last.status === 'sent' || last.status === 'acknowledged')) continue;
      const snoozed = last?.status === 'snoozed';
      proposals.push({ ...p, snoozed: snoozed && last.on >= now, reminder: snoozed && last.on < now });
    }
  }
  return { deadlines: d, released, proposals, watch: watchList(c, now, d), notices: notices(c, now, d) };
}

/** The upcoming dates the agent is watching, soonest first. */
function watchList(c, now, d) {
  if (!c.submittedOn || d.releasedOn) return [];
  const items = [];
  if (!d.filedOn) items.push({ label: 'Filing on the grievance portal', on: d.fileBy });
  else if (!d.escalatedOn && d.officerDueOn >= now) items.push({ label: "Officer's decision due", on: d.officerDueOn });
  if (d.dgoDueOn && d.dgoDueOn > now) items.push({ label: "District Grievance Officer's decision due", on: d.dgoDueOn });
  const call = firstEvent(happened(c, now), 'call_booked');
  if (call && call.callOn >= now) items.push({ label: 'Video call', on: call.callOn, time: call.callTime });
  if (d.day75 >= now) items.push({ label: 'Day 75 check', on: d.day75 });
  if (d.day90 >= now) items.push({ label: 'Day 90', on: d.day90 });
  return items.sort((a, b) => a.on.localeCompare(b.on));
}

/** Things the agent notices and logs without asking the merchant for anything. */
function notices(c, now, d) {
  const out = [];
  if (d.dgoDueOn && d.dgoDueOn <= now && !(d.releasedOn && d.releasedOn < d.dgoDueOn)) {
    out.push({ id: 'dgo-due', on: d.dgoDueOn, text: `Still waiting. Watching Day 75 (${fmtDate(d.day75)}) and Day 90 (${fmtDate(d.day90)}).` });
  }
  if (c.submittedOn && d.day75 <= now && !(d.releasedOn && d.releasedOn <= d.day75)) {
    out.push({ id: 'day75', on: d.day75, text: `Day 75 check: still on hold. Day 90 is ${fmtDate(d.day90)}.` });
  }
  return out;
}

// ───────────── Activity log ─────────────

/** "What your agent did": every step, newest first. Each row: { on, actor: you|agent|officer|system, text }. */
export function activity(c, now) {
  const d = deadlines(c, now);
  const rows = [];
  // rank orders rows within one day: what happened (0), what the agent did (1), what you did (2)
  const add = (on, rank, actor, text) => rows.push({ on, rank, seq: rows.length, actor, text });

  if (c.submittedOn) {
    add(c.submittedOn, 0, 'you', 'You sent your case file and statement');
    add(c.submittedOn, 1, 'agent', `Started watching your deadlines: filing by ${fmtDate(d.fileBy)}, Day 75 and Day 90`);
  }
  for (const e of happened(c, now)) {
    if (e.type === 'filed') add(e.on, 0, 'system', `Filed on the national grievance portal · ${AGENT_FACTS.grievanceRef}`);
    if (e.type === 'officer_request') add(e.on, 0, 'officer', 'The officer asked for proof of delivery and the customer’s messages');
    if (e.type === 'call_booked') add(e.on, 0, 'officer', `Video call booked for ${fmtDate(e.callOn)}, ${e.callTime}`);
    if (e.type === 'released') add(e.on, 0, 'officer', `Hold lifted. ₹1,800 goes back into your settlement on ${fmtDate(addDays(e.on, 1))}`);
  }
  for (const p of triggered(c, now, d)) add(p.on, 1, 'agent', AGENT_COPY[p.type].drafted);
  for (const n of notices(c, now, d)) add(n.on, 1, 'agent', n.text);
  for (const a of c.actions.filter((x) => x.on <= now)) {
    const copy = AGENT_COPY[a.type];
    if (a.status === 'sent') {
      add(a.on, 2, 'you', `You ${a.edited ? 'edited and approved' : 'approved'} the ${copy.title.toLowerCase()}`);
      add(a.on, 2, 'system', `Sent to ${copy.sentTo}${copy.via ? ` ${copy.via}` : ''}`);
    }
    if (a.status === 'acknowledged') add(a.on, 2, 'you', 'You read the call brief');
    if (a.status === 'snoozed') add(a.on, 2, 'you', 'You chose “Not now”. The agent will remind you at the next update');
    if (a.status === 'reminded') add(a.on, 1, 'agent', `Reminded you: ${copy.ready.toLowerCase()}`);
  }
  return rows.sort((a, b) => b.on.localeCompare(a.on) || b.rank - a.rank || b.seq - a.seq);
}

// ───────────── Tracker timeline ─────────────

/**
 * The tracker's steps, built from the same deadlines the agent uses.
 * Each item: { title, state: 'done'|'now'|'next'|'missed'|'faded', when, text }.
 * `sentIn` is the measured alert-to-submit time ("1 min 24 s"), or null.
 */
export function timeline(c, now, sentIn) {
  const d = deadlines(c, now);
  const events = happened(c, now);
  const request = firstEvent(events, 'officer_request');
  const call = firstEvent(events, 'call_booked');
  const byOfficer = Boolean(d.releasedOn && d.officerDueOn && d.releasedOn <= d.officerDueOn);
  const items = [
    { title: 'Hold placed', state: 'done', when: fmtDate(c.holdOn), text: '₹1,800 held at the request of Cyber Crime PS, Lucknow.' },
    {
      title: 'You responded',
      state: 'done',
      when: fmtDate(c.submittedOn ?? c.holdOn),
      text: sentIn ? `Case file and statement sent in ${sentIn}.` : 'Case file and statement sent from your phone.',
    },
    d.filedOn
      ? { title: 'Filed on the national grievance portal', state: 'done', when: fmtDate(d.filedOn), text: `Reference ${AGENT_FACTS.grievanceRef}.` }
      : { title: 'Filed on the national grievance portal', state: 'now', when: `By ${fmtDate(d.fileBy ?? addDays(c.holdOn, 7))}`, text: 'We file it for you. Nothing for you to do.' },
  ];

  if (byOfficer) {
    items.push({ title: 'Officer decides', state: 'done', when: fmtDate(d.releasedOn), text: 'Hold released. No further action.' });
  } else if (!d.filedOn) {
    items.push({ title: 'Officer decides', state: 'next', when: '15 days after filing', text: BY_VIDEO });
  } else if (now <= d.officerDueOn) {
    let text = BY_VIDEO;
    if (call) text = `Video call booked for ${fmtDate(call.callOn)}, ${call.callTime}.`;
    else if (request) {
      const reply = sentAction(c, 'officer_reply', now);
      text = reply
        ? `The officer asked for more proof on ${fmtDate(request.on)}. You replied on ${fmtDate(reply.on)}.`
        : `The officer asked for proof of delivery and the customer’s messages on ${fmtDate(request.on)}.`;
    }
    items.push({ title: 'Officer decides', state: 'now', when: `By ${fmtDate(d.officerDueOn)}`, text });
  } else {
    items.push({
      title: 'Officer decides',
      state: 'missed',
      when: `No decision by ${fmtDate(d.officerDueOn)}`,
      text: d.escalatedOn ? `You asked for a review on ${fmtDate(d.escalatedOn)}.` : 'Your request for review is ready.',
    });
  }

  if (byOfficer) {
    items.push({ title: 'District Grievance Officer', state: 'faded', when: 'Not needed', text: '' });
  } else if (d.escalatedOn && now < d.dgoDueOn) {
    items.push({ title: 'District Grievance Officer', state: 'now', when: `By ${fmtDate(d.dgoDueOn)}`, text: `Your request for review was sent on ${fmtDate(d.escalatedOn)}.` });
  } else if (d.escalatedOn) {
    items.push({ title: 'District Grievance Officer', state: 'missed', when: `No direction by ${fmtDate(d.dgoDueOn)}`, text: 'Your agent kept watching Day 75 and Day 90.' });
  } else {
    items.push({
      title: 'If no decision: District Grievance Officer',
      state: 'next',
      when: d.officerDueOn ? `By ${fmtDate(addDays(d.officerDueOn, 16))}` : '15 days later',
      text: 'Your agent drafts the request for review for you.',
    });
  }

  if (byOfficer) {
    items.push({ title: 'Day 75 check', state: 'faded', when: fmtDate(d.day75), text: '' });
    items.push({ title: 'Day 90: the hold must end', state: 'faded', when: fmtDate(d.day90), text: '' });
  } else {
    const checked = now >= d.day75;
    items.push({ title: 'Day 75 check', state: checked ? 'done' : 'next', when: fmtDate(d.day75), text: checked ? 'Checked: still on hold.' : 'We remind you and confirm the status.' });
    const release = sentAction(c, 'release_request', now);
    if (now >= d.day90) {
      items.push({
        title: 'Day 90: the hold must end',
        state: release ? 'done' : 'now',
        when: fmtDate(d.day90),
        text: release ? `You asked for the hold to be lifted on ${fmtDate(release.on)}.` : 'Your release request is ready.',
      });
    } else {
      items.push({ title: 'Day 90: the hold must end', state: 'next', when: fmtDate(d.day90), text: 'A contested hold lapses unless police get a legal order to extend it.' });
    }
    if (d.releasedOn) {
      items.push({ title: 'Hold lifted', state: 'done', when: fmtDate(d.releasedOn), text: `₹1,800 goes back into your settlement on ${fmtDate(addDays(d.releasedOn, 1))}.` });
    }
  }
  return items;
}

/** The result once the hold is lifted: { releasedOn, creditedOn, days }, or null. */
export function outcome(c) {
  const releasedOn = firstEvent(c.events, 'released')?.on;
  return releasedOn ? { releasedOn, creditedOn: addDays(releasedOn, 1), days: daysBetween(c.holdOn, releasedOn) } : null;
}
