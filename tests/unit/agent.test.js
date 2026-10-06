// Unit tests for the follow-up agent's rules (agent.js): pure date maths and decisions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCENARIOS } from '../../case-data.js';
import { activity, addDays, daysBetween, deadlines, evaluate, fmtDate, newCase, outcome, timeline, withAction, withEvents } from '../../agent.js';

const submitted = () => ({ ...newCase(), submittedOn: '2026-10-05' });
const types = (r) => r.proposals.map((p) => p.type);

/** Walks a scenario. `decide(case, proposal, now)` returns the case after the merchant acts. */
function walk(name, decide = (c) => c) {
  let c = submitted();
  const steps = [];
  for (const step of SCENARIOS[name]) {
    c = withEvents(c, step);
    const r = evaluate(c, step.on);
    steps.push({ on: step.on, proposals: types(r), watch: r.watch, notices: r.notices.map((n) => n.id) });
    for (const p of r.proposals) c = decide(c, p, step.on);
  }
  return { c, steps };
}

const approveAll = (c, p, now) => withAction(c, p, p.type === 'call_brief' ? 'acknowledged' : 'sent', now);

function deepFreeze(o) {
  Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(o);
}

// ───────────── Dates ─────────────

test('date helpers', () => {
  assert.equal(addDays('2026-10-06', 15), '2026-10-21');
  assert.equal(addDays('2026-10-05', 90), '2027-01-03');
  assert.equal(daysBetween('2026-10-05', '2026-10-16'), 11);
  assert.equal(daysBetween('2026-10-05', '2027-01-05'), 92);
  assert.equal(fmtDate('2026-10-21'), 'Wed 21 Oct');
  assert.equal(fmtDate('2027-01-03'), 'Sun 3 Jan 2027');
  assert.equal(fmtDate('2026-10-16', { year: true }), 'Fri 16 Oct 2026');
});

test('deadlines are computed from the dates', () => {
  let c = withEvents(submitted(), { on: '2026-10-06', events: [{ type: 'filed' }] });
  const d = deadlines(c, '2026-10-06');
  assert.equal(d.fileBy, '2026-10-12');
  assert.equal(d.officerDueOn, '2026-10-21');
  assert.equal(d.day75, '2026-12-19');
  assert.equal(d.day90, '2027-01-03');
  assert.equal(d.dgoDueOn, null);

  c = withAction(c, { id: 'escalation', type: 'escalation' }, 'sent', '2026-10-22');
  assert.equal(deadlines(c, '2026-10-22').dgoDueOn, '2026-11-06');
});

test('nothing is proposed before the merchant submits', () => {
  const c = withEvents(newCase(), { on: '2026-10-09', events: [{ type: 'officer_request' }] });
  const r = evaluate(c, '2026-10-09');
  assert.deepEqual(r.proposals, []);
  assert.deepEqual(r.watch, []);
});

// ───────────── Scenario: the officer responds ─────────────

test('Responds: reply on Fri 9 Oct, call brief on Mon 12 Oct, released Fri 16 Oct after 11 days', () => {
  const { c, steps } = walk('responds', approveAll);
  assert.deepEqual(steps.map((s) => s.on), ['2026-10-05', '2026-10-06', '2026-10-09', '2026-10-12', '2026-10-16']);
  assert.deepEqual(steps.map((s) => s.proposals), [[], [], ['officer_reply'], ['call_brief'], []]);
  assert.deepEqual(steps[1].watch.map((w) => `${w.label} ${fmtDate(w.on)}`), ["Officer's decision due Wed 21 Oct", 'Day 75 check Sat 19 Dec', 'Day 90 Sun 3 Jan 2027']);
  assert.deepEqual(steps[4].watch, []);
  assert.deepEqual(outcome(c), { releasedOn: '2026-10-16', creditedOn: '2026-10-17', days: 11 });
});

test('the officer reply proposal explains why and is due within a day', () => {
  const c = withEvents(withEvents(submitted(), SCENARIOS.responds[1]), SCENARIOS.responds[2]);
  const [p] = evaluate(c, '2026-10-09').proposals;
  assert.equal(p.id, 'officer_reply@2026-10-09');
  assert.equal(p.dueBy, '2026-10-10');
  assert.match(p.why, /^The officer asked on Fri 9 Oct: “Please share proof of delivery/);
});

// ───────────── Scenario: the officer goes quiet ─────────────

test('Goes quiet: escalation Thu 22 Oct, watching on Fri 6 Nov, release request Sun 3 Jan 2027, released Tue 5 Jan 2027 after 92 days', () => {
  const { c, steps } = walk('quiet', approveAll);
  assert.deepEqual(steps.map((s) => s.on), ['2026-10-05', '2026-10-06', '2026-10-22', '2026-11-06', '2027-01-03', '2027-01-05']);
  assert.deepEqual(steps.map((s) => s.proposals), [[], [], ['escalation'], [], ['release_request'], []]);
  assert.deepEqual(steps[3].notices, ['dgo-due']);
  assert.deepEqual(steps[3].watch.map((w) => w.label), ['Day 75 check', 'Day 90']);
  assert.deepEqual(outcome(c), { releasedOn: '2027-01-05', creditedOn: '2027-01-06', days: 92 });
});

test('the escalation explains the missed deadline, and approving it sets the District Grievance Officer date', () => {
  let c = withEvents(submitted(), SCENARIOS.quiet[1]);
  const [p] = evaluate(c, '2026-10-22').proposals;
  assert.equal(p.type, 'escalation');
  assert.equal(p.why, "The officer's 15 days ended on Wed 21 Oct with no decision.");
  c = withAction(c, p, 'sent', '2026-10-22');
  const r = evaluate(c, '2026-10-22');
  assert.deepEqual(r.proposals, []);
  assert.equal(r.deadlines.dgoDueOn, '2026-11-06');
  assert.deepEqual(r.watch.map((w) => `${w.label} ${fmtDate(w.on)}`), ["District Grievance Officer's decision due Fri 6 Nov", 'Day 75 check Sat 19 Dec', 'Day 90 Sun 3 Jan 2027']);
});

test('on Fri 6 Nov the agent only notes that it is still watching', () => {
  let c = withEvents(submitted(), SCENARIOS.quiet[1]);
  c = withAction(c, { id: 'escalation', type: 'escalation' }, 'sent', '2026-10-22');
  const r = evaluate(c, '2026-11-06');
  assert.deepEqual(r.proposals, []);
  assert.equal(r.notices[0].text, 'Still waiting. Watching Day 75 (Sat 19 Dec) and Day 90 (Sun 3 Jan 2027).');
});

test('the release request is proposed on Day 90 even if the escalation was never sent', () => {
  const c = withEvents(submitted(), SCENARIOS.quiet[1]);
  assert.deepEqual(types(evaluate(c, '2027-01-03')), ['escalation', 'release_request']);
});

// ───────────── Proposals: no duplicates, approve, Not now ─────────────

test('evaluating again never duplicates a proposal', () => {
  const c = withEvents(withEvents(submitted(), SCENARIOS.responds[1]), SCENARIOS.responds[2]);
  const a = evaluate(c, '2026-10-09');
  const b = evaluate(c, '2026-10-12');
  assert.equal(a.proposals.length, 1);
  assert.deepEqual(b.proposals.map((p) => p.id), a.proposals.map((p) => p.id));
});

test('approving moves the case forward and the proposal never comes back', () => {
  let c = withEvents(withEvents(submitted(), SCENARIOS.responds[1]), SCENARIOS.responds[2]);
  const [p] = evaluate(c, '2026-10-09').proposals;
  c = withAction(c, p, 'sent', '2026-10-09');
  assert.deepEqual(evaluate(c, '2026-10-09').proposals, []);
  assert.deepEqual(evaluate(c, '2026-10-15').proposals, []);
  assert.match(timeline(c, '2026-10-09', null)[3].text, /You replied on Fri 9 Oct/);
});

test('"Not now" keeps the proposal, hides it until the next step, then reminds', () => {
  let c = withEvents(withEvents(submitted(), SCENARIOS.responds[1]), SCENARIOS.responds[2]);
  const [p] = evaluate(c, '2026-10-09').proposals;
  c = withAction(c, p, 'snoozed', '2026-10-09');

  const same = evaluate(c, '2026-10-09').proposals;
  assert.equal(same.length, 1);
  assert.equal(same[0].snoozed, true);
  assert.equal(same[0].reminder, false);

  c = withEvents(c, SCENARIOS.responds[3]);
  const next = evaluate(c, '2026-10-12').proposals;
  assert.deepEqual(next.map((x) => [x.type, x.snoozed, x.reminder]), [['officer_reply', false, true], ['call_brief', false, false]]);

  c = withAction(c, next[0], 'reminded', '2026-10-12');
  assert.deepEqual(evaluate(c, '2026-10-12').proposals.map((x) => [x.type, x.reminder]), [['officer_reply', false], ['call_brief', false]]);
});

test('once the hold is lifted, anything still waiting is no longer proposed', () => {
  let c = withEvents(withEvents(submitted(), SCENARIOS.responds[1]), SCENARIOS.responds[2]);
  const [p] = evaluate(c, '2026-10-09').proposals;
  c = withAction(c, p, 'snoozed', '2026-10-09');
  c = withEvents(c, SCENARIOS.responds[4]);
  const r = evaluate(c, '2026-10-16');
  assert.equal(r.released, true);
  assert.deepEqual(r.proposals, []);
});

test('the engine is pure: it never changes the case it is given', () => {
  const c = deepFreeze(withEvents(withEvents(submitted(), SCENARIOS.quiet[1]), SCENARIOS.quiet[2]));
  assert.doesNotThrow(() => {
    evaluate(c, '2027-01-03');
    activity(c, '2027-01-03');
    timeline(c, '2027-01-03', '1 min 24 s');
  });
});

// ───────────── Log and timeline ─────────────

test('the activity log records each step, newest first', () => {
  const { c } = walk('quiet', approveAll);
  const rows = activity(c, '2027-01-05');
  assert.equal(rows[0].on, '2027-01-05');
  assert.match(rows[0].text, /^Hold lifted/);
  const lines = rows.map((r) => `${r.on} ${r.actor}: ${r.text}`);
  assert.ok(lines.includes('2026-10-22 system: Sent to the District Grievance Officer via the grievance portal'));
  assert.ok(lines.includes('2026-10-22 you: You approved the request for review'));
  assert.ok(lines.includes('2026-11-06 agent: Still waiting. Watching Day 75 (Sat 19 Dec) and Day 90 (Sun 3 Jan 2027).'));
  assert.ok(lines.includes('2027-01-03 system: Sent to our grievance desk, copied to the officer'));
  const sent = lines.indexOf('2026-10-22 system: Sent to the District Grievance Officer via the grievance portal');
  const approved = lines.indexOf('2026-10-22 you: You approved the request for review');
  const drafted = lines.indexOf('2026-10-22 agent: Drafted a request for review by the District Grievance Officer');
  assert.ok(sent < approved && approved < drafted, 'within a day, newest first');
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].on >= rows[i].on);
});

test('the log records edits and "Not now"', () => {
  let c = withEvents(withEvents(submitted(), SCENARIOS.responds[1]), SCENARIOS.responds[2]);
  const [p] = evaluate(c, '2026-10-09').proposals;
  c = withAction(c, p, 'snoozed', '2026-10-09');
  c = withAction(c, p, 'sent', '2026-10-09', { edited: true });
  const texts = activity(c, '2026-10-09').map((r) => r.text);
  assert.ok(texts.includes('You edited and approved the reply to the officer'));
  assert.ok(texts.some((t) => t.startsWith('You chose “Not now”')));
});

test('timeline states follow the quiet path', () => {
  let c = withEvents(submitted(), SCENARIOS.quiet[1]);
  c = withAction(c, { id: 'escalation', type: 'escalation' }, 'sent', '2026-10-22');
  const states = (now) => timeline(c, now, null).map((i) => i.state).join(' ');
  assert.equal(states('2026-10-22'), 'done done done missed now next next');
  assert.equal(states('2026-11-06'), 'done done done missed missed next next');
  const items = timeline(c, '2026-11-06', null);
  assert.equal(items[3].when, 'No decision by Wed 21 Oct');
  assert.equal(items[4].when, 'No direction by Fri 6 Nov');
});

test('timeline after the officer releases the hold fades the later steps', () => {
  const { c } = walk('responds', approveAll);
  const items = timeline(c, '2026-10-16', '1 min 24 s');
  assert.deepEqual(items.map((i) => i.state), ['done', 'done', 'done', 'done', 'faded', 'faded', 'faded']);
  assert.equal(items[1].text, 'Case file and statement sent in 1 min 24 s.');
  assert.equal(items[3].when, 'Fri 16 Oct');
});
