// End-to-end: the follow-up agent in both demo scenarios, its fallback, "Not now", and the app's wording.
import { expect, test } from '@playwright/test';

const BANNED = /\b(fake\w*|frozen|freez\w*|FIR|accus\w*)\b|police complaint/i;

function watchErrors(page) {
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

const app = (page) => page.locator('#phone');
const current = (page) => page.locator('.screen:not(.leaving)');
const card = (page) => current(page).locator('.agent-card');

/** Runs something in the presenter rail; on phones the rail is a sheet behind "Demo controls". */
async function inRail(page, isMobile, fn) {
  if (isMobile) await page.getByRole('button', { name: 'Demo controls', exact: true }).click();
  await fn(page.locator('#rail'));
  if (isMobile && (await page.locator('#rail.open').count())) await page.keyboard.press('Escape');
}

/** Starts at the tracker, just after submitting, in the chosen scenario. */
async function startTracking(page, isMobile, scenario) {
  await page.goto('/');
  await inRail(page, isMobile, async (rail) => {
    await rail.getByRole('button', { name: scenario === 'quiet' ? 'Goes quiet' : 'Responds' }).click();
    await rail.getByRole('button', { name: /Tracer follows up/ }).click();
  });
  await expect(card(page)).toContainText("I'm watching 3 dates for you");
}

/** Moves time on: through the rail's Advance button, or the tracker's demo button. */
async function advance(page, isMobile, viaRail, date) {
  if (viaRail) {
    await inRail(page, isMobile, (rail) => rail.getByRole('button', { name: `Advance to ${date}` }).click());
  } else {
    await app(page).getByRole('button', { name: `Demo · Skip ahead to ${date}` }).click();
  }
  await expect(page.locator('.screen:not(.leaving) .summary')).toContainText(`as of ${date}`);
}

async function approve(page, name = 'Approve and send') {
  const button = card(page).getByRole('button', { name });
  await expect(button).toBeEnabled({ timeout: 60_000 }); // a live draft, or the scripted fallback
  await button.click();
}

async function expectCleanText(page, seen) {
  const text = await app(page).innerText();
  seen.push(text);
  expect(text).not.toMatch(BANNED);
}

test('Responds: the agent drafts a reply, prepares a call brief, and the hold is lifted after 11 days', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  const seen = [];
  const viaRail = !isMobile;
  await startTracking(page, isMobile, 'responds');

  await advance(page, isMobile, viaRail, 'Tue 6 Oct');
  await advance(page, isMobile, viaRail, 'Fri 9 Oct');
  await expect(page.locator('.push')).toContainText('Officer asked for delivery proof');
  await expect(card(page)).toContainText('Needs your OK');
  await expect(card(page)).toContainText('Tracer');
  await expect(card(page)).toContainText('Reply to the officer');
  await expect(card(page)).toContainText('The officer asked on Fri 9 Oct');
  await expect(card(page).locator('#ag-source')).toContainText(/Drafted live by gpt-oss|Standard draft/, { timeout: 60_000 });
  await expect(card(page).locator('#ag-text .tag').first()).toBeVisible();
  await expectCleanText(page, seen);
  await approve(page);
  await expect(card(page)).toContainText('Sent to the investigating officer · Fri 9 Oct');
  await expect(page.locator('.log')).toContainText('You approved the reply to the officer');
  await expect(page.locator('.log')).toContainText('Sent to the investigating officer via the grievance portal');

  await advance(page, isMobile, viaRail, 'Mon 12 Oct');
  await expect(card(page)).toContainText('Your call brief');
  await expect(card(page).locator('.brief')).toContainText('What did the customer buy, and when?', { timeout: 60_000 });
  await expect(card(page).getByRole('button', { name: 'Approve and send' })).toHaveCount(0); // nothing is sent
  await expectCleanText(page, seen);
  await approve(page, 'Got it');
  await expect(card(page)).toContainText('Brief read · Mon 12 Oct');

  await advance(page, isMobile, viaRail, 'Fri 16 Oct');
  await expect(card(page)).toContainText('The hold is lifted');
  await app(page).getByRole('button', { name: 'See the result' }).click();
  await expect(app(page).getByRole('heading', { name: 'Hold lifted' })).toBeVisible();
  await expect(page.locator('.facts')).toContainText('Days on hold11');
  await expect(page.locator('.facts')).toContainText('Released onFri 16 Oct 2026');
  await expectCleanText(page, seen);

  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  expect(errors).toEqual([]);
});

test('Goes quiet: escalation, a watch note, and the hold lapses on Day 90 with nothing to approve', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  const seen = [];
  const viaRail = isMobile; // the other control from the Responds test
  await startTracking(page, isMobile, 'quiet');

  await advance(page, isMobile, viaRail, 'Tue 6 Oct');
  await advance(page, isMobile, viaRail, 'Thu 22 Oct');
  await expect(page.locator('.push')).toContainText('No decision in 15 days');
  await expect(card(page)).toContainText('Request for review');
  await expect(card(page)).toContainText("The officer's 15 days ended on Wed 21 Oct with no decision.");
  await expectCleanText(page, seen);
  await approve(page);
  await expect(card(page)).toContainText('Sent to the District Grievance Officer · Thu 22 Oct');
  await expect(card(page).locator('.watch')).toContainText("District Grievance Officer's decision dueFri 6 Nov");

  await advance(page, isMobile, viaRail, 'Fri 6 Nov');
  await expect(card(page)).toContainText('Watching');
  await expect(page.locator('.log')).toContainText('Still waiting. Watching Day 75 (Sat 19 Dec) and Day 90 (Sun 3 Jan 2027).');

  await advance(page, isMobile, viaRail, 'Sun 3 Jan 2027');
  await expect(page.locator('.push')).toContainText('Day 90 passed with no order to continue it, so the hold lapsed');
  await expect(card(page)).toContainText('The hold lapsed on Day 90 and ₹1,800 was released.');
  await expect(card(page).getByRole('button', { name: 'Approve and send' })).toHaveCount(0); // nothing to approve
  await expect(page.locator('.log')).toContainText('Day 90: no order to continue the hold, so it lapsed and ₹1,800 was released');
  await expect(page.locator('.log')).toContainText('Confirmed the release and told you');
  await expectCleanText(page, seen);

  await app(page).getByRole('button', { name: 'See the result' }).click();
  await expect(page.locator('.facts')).toContainText('Days on hold90');
  await expect(page.locator('.facts')).toContainText('Released onSun 3 Jan 2027');
  await expect(page.locator('.facts')).toContainText('How it endedLapsed on Day 90');
  await expect(page.locator('.facts')).toContainText('Sent by Tracer with your OK1');
  await expectCleanText(page, seen);
  expect(errors).toEqual([]);
});

test('fallback: when the AI is down, each agent draft is the standard draft and says so', async ({ page, isMobile }) => {
  await page.route('**/api/draft', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"api_key_missing"}' }));
  await startTracking(page, isMobile, 'responds');
  await advance(page, isMobile, false, 'Tue 6 Oct');
  await advance(page, isMobile, false, 'Fri 9 Oct');
  await expect(page.locator('#toast')).toHaveText('The open model did not answer, so this is the standard draft.');
  await expect(card(page).locator('#ag-source')).toHaveText('Standard draft');
  await expect(card(page).locator('#ag-text')).toContainText('Thank you for your message. As requested, I am sharing the proof of delivery');
  await approve(page);
  await advance(page, isMobile, false, 'Mon 12 Oct');
  await expect(card(page).locator('.brief')).toContainText('A cotton kurta set, size M, paid ₹1,800 by UPI on 14 Sep');
  await expect(card(page).locator('#ag-source')).toHaveText('Standard draft');
});

test('"Not now" keeps the reply waiting and the agent reminds at the next update', async ({ page, isMobile }) => {
  await startTracking(page, isMobile, 'responds');
  await advance(page, isMobile, false, 'Tue 6 Oct');
  await advance(page, isMobile, false, 'Fri 9 Oct');
  const later = card(page).getByRole('button', { name: 'Not now' });
  await expect(later).toBeEnabled({ timeout: 60_000 });
  await later.click();
  await expect(card(page)).toContainText('Waiting for you: reply to the officer');
  await expect(page.locator('.summary .badge')).toHaveText('Reply ready');

  await advance(page, isMobile, false, 'Mon 12 Oct');
  await expect(page.locator('.push')).toContainText('Also still waiting: reply to the officer');
  await expect(card(page)).toContainText('Reply to the officer');
  await expect(card(page)).toContainText('Also waiting: your call brief');
  await expect(page.locator('.log')).toContainText('Reminded you: your reply to the officer is ready');
  await expect(page.locator('.log')).toContainText('You chose “Not now”');
});

test('Home, Holds and the tab count show when the agent needs an OK', async ({ page, isMobile }) => {
  await startTracking(page, isMobile, 'responds');
  await advance(page, isMobile, false, 'Tue 6 Oct');
  await expect(app(page).locator('.tab .count')).toHaveCount(0);
  await advance(page, isMobile, false, 'Fri 9 Oct');
  await current(page).getByRole('button', { name: 'Back' }).click();
  const alert = app(page).locator('.alert-card');
  await expect(alert).toHaveClass(/action/);
  await expect(alert).toContainText('Action ready');
  await expect(alert).toContainText('Your reply to the officer is ready');
  await expect(alert).toContainText('Tap to review and send');
  await expect(app(page).locator('.tab .count')).toHaveText(/1/);
  await current(page).locator('.tab[data-arg="holds"]').click();
  await expect(app(page).locator('.hold-card .badge')).toHaveText('Reply ready');
  await app(page).locator('.hold-card').click();
  await expect(card(page)).toContainText('Needs your OK');
});
