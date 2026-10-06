// Every weekday + date written in the app must match the real calendar.
// The story's "today" is Mon 5 Oct 2026; dates without a year are in 2026, except January (2027).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fmtDate } from '../../agent.js';
import { SCENARIOS } from '../../case-data.js';

const FILES = ['case-data.js', 'screens.js', 'index.html', 'agent.js', 'api/draft.js'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PATTERN = /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*,? (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?: (\d{4}))?/g;

test('every weekday matches its date', () => {
  const found = [];
  for (const file of FILES) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    for (const [text, day, date, month, year] of source.matchAll(PATTERN)) {
      const m = MONTHS.indexOf(month);
      const y = year ? Number(year) : m === 0 ? 2027 : 2026;
      const actual = DAYS[new Date(Date.UTC(y, m, Number(date))).getUTCDay()];
      found.push(text);
      assert.equal(actual, day, `${file}: "${text}" is a ${actual}`);
    }
  }
  assert.ok(found.length >= 10, `expected to check many dates, found ${found.length}`);
});

test('the story timeline adds up from Mon 5 Oct 2026', () => {
  const day = (m, d, y = 2026) => Date.UTC(y, m, d) / 86_400_000;
  const holdPlaced = day(9, 5);
  assert.equal(day(9, 12) - holdPlaced, 7, 'respond by Mon 12 Oct = 7 days');
  assert.equal(day(9, 21) - day(9, 6), 15, 'officer decides 15 days after filing on Tue 6 Oct');
  assert.equal(day(9, 22) - day(9, 21), 1, 'escalation the day after the officer misses Wed 21 Oct');
  assert.equal(day(10, 6) - day(9, 22), 15, 'District Grievance Officer 15 days after the escalation: Fri 6 Nov');
  assert.equal(day(0, 5, 2027) - holdPlaced, 92, '92 days on hold on the quiet path, released Tue 5 Jan 2027');
  assert.equal(day(11, 19) - holdPlaced, 75, 'day 75 check on Sat 19 Dec');
  assert.equal(day(0, 3, 2027) - holdPlaced, 90, 'day 90 on Sun 3 Jan 2027');
  assert.equal(day(9, 16) - holdPlaced, 11, '11 days on hold, released Fri 16 Oct');
});

test('the scenario steps fall on the dates the addendum gives', () => {
  assert.deepEqual(SCENARIOS.responds.map((step) => fmtDate(step.on)), ['Mon 5 Oct', 'Tue 6 Oct', 'Fri 9 Oct', 'Mon 12 Oct', 'Fri 16 Oct']);
  assert.deepEqual(SCENARIOS.quiet.map((step) => fmtDate(step.on)), ['Mon 5 Oct', 'Tue 6 Oct', 'Thu 22 Oct', 'Fri 6 Nov', 'Sun 3 Jan 2027', 'Tue 5 Jan 2027']);
});
