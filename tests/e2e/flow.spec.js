// End-to-end: the merchant's whole journey, the fallback path, uploads, dark mode and the rail.
import { expect, test } from '@playwright/test';

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/** Fails the test on any console error or uncaught exception. */
function watchErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function expectNoHorizontalScroll(page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

const screen = (page) => page.locator('.screen:not(.leaving)');
const app = (page) => page.locator('#phone');

async function openHold(page) {
  await page.goto('/');
  await app(page).getByRole('button', { name: /a cyber-fraud report names this payment/ }).click();
  await expect(screen(page).getByRole('heading', { name: 'Payment on hold' })).toBeVisible();
}

test('happy path: from the lock-screen alert to the hold being lifted', async ({ page }) => {
  const errors = watchErrors(page);
  await openHold(page);
  await expectNoHorizontalScroll(page);

  await app(page).getByRole('button', { name: /Build my response/ }).click();
  await expect(app(page).getByText('4 of 5 ready')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await app(page).getByRole('button', { name: "Add the customer's chat" }).click();
  await expect(app(page).getByRole('dialog', { name: 'Add from your phone' })).toBeVisible();
  await app(page).getByRole('button', { name: /Chat screenshot, 19 Sep/ }).click();
  await expect(app(page).getByText('What it shows')).toBeVisible();
  await app(page).getByRole('button', { name: 'Add to case file' }).click();
  await expect(app(page).getByText('5 of 5 ready')).toBeVisible();
  await expect(app(page).getByText('Exchange dispute, not fraud')).toBeVisible();

  await app(page).getByRole('button', { name: 'Draft my statement' }).click();
  const submit = app(page).getByRole('button', { name: 'Review and submit' });
  await expect(submit).toBeEnabled({ timeout: 60_000 }); // live draft or the scripted fallback
  await expect(page.locator('#st-text .tag').first()).toBeVisible();
  await page.locator('#st-text .tag').first().click();
  await expect(page.locator('#toast')).toContainText(/^E\d · /);
  await expectNoHorizontalScroll(page);

  await submit.click();
  const send = app(page).getByRole('button', { name: /Submit response/ });
  await expect(send).toBeDisabled();
  await app(page).getByText('I confirm these facts are true').click();
  await expect(send).toBeEnabled();
  await send.click();
  await expect(app(page).getByRole('heading', { name: 'Response submitted' })).toBeVisible();
  await expect(app(page).getByText('Alert to submitted', { exact: true }).last()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await app(page).getByRole('button', { name: 'Track this hold' }).click();
  const skip = (date) => app(page).getByRole('button', { name: `Demo · Skip ahead to ${date}` }).click();
  const agentButton = (name) => page.locator('.screen:not(.leaving) .agent-card').getByRole('button', { name });
  await skip('Tue 6 Oct');
  await skip('Fri 9 Oct');
  await expect(agentButton('Approve and send')).toBeEnabled({ timeout: 60_000 });
  await agentButton('Approve and send').click();
  await expect(page.locator('.screen:not(.leaving) .agent-card')).toContainText('Sent to the investigating officer');
  await skip('Mon 12 Oct');
  await expect(agentButton('Got it')).toBeEnabled({ timeout: 60_000 });
  await agentButton('Got it').click();
  await skip('Fri 16 Oct');
  await expect(page.locator('.push')).toContainText('Hold lifted: ₹1,800 is yours');
  await expect(screen(page).locator('.summary .badge')).toHaveText('Released');
  await app(page).getByRole('button', { name: 'See the result' }).click();

  await expect(app(page).getByRole('heading', { name: 'Hold lifted' })).toBeVisible();
  await expect(page.locator('.facts')).toContainText('Days on hold');
  await app(page).getByRole('button', { name: 'Done' }).click();
  await expect(screen(page).locator('.ledger')).toContainText('Recovered₹1,800');
  await expectNoHorizontalScroll(page);

  expect(errors).toEqual([]);
});

test('fallback: when the AI is down the scripted draft appears and says so, in English and Hindi', async ({ page }) => {
  const errors = watchErrors(page);
  await page.route('**/api/draft', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"api_key_missing"}' }));
  await openHold(page);
  await app(page).getByRole('button', { name: /Build my response/ }).click();
  await app(page).getByRole('button', { name: 'Continue without it' }).click();

  await expect(page.locator('#toast')).toHaveText('The open model did not answer, so this is the standard draft.');
  await expect(app(page).getByRole('button', { name: 'Review and submit' })).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('#st-source')).toHaveText('Standard draft from your case file');
  await expect(page.locator('#st-text')).toContainText('I run Kesar Kurtas');
  await expect(page.locator('#st-text')).not.toContainText('E5'); // no chat was added

  await app(page).getByRole('button', { name: 'हिंदी' }).click();
  await expect(app(page).getByRole('button', { name: 'Review and submit' })).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('#st-text')).toContainText('मैं जयपुर में केसर कुर्ताज़');
  await expect(page.locator('.letter-to')).toHaveText('सेवा में, जाँच अधिकारी, साइबर क्राइम थाना, लखनऊ');
  expect(await page.evaluate(() => document.fonts.check('16px Mukta', 'मैं'))).toBe(true);

  expect(errors.filter((e) => !e.includes('status of 503'))).toEqual([]);
});

test('a real image can be picked, tagged and added as E5', async ({ page }) => {
  await openHold(page);
  await app(page).getByRole('button', { name: /Build my response/ }).click();
  await app(page).getByRole('button', { name: "Add the customer's chat" }).click();
  await page.setInputFiles('#file-input', { name: 'screenshot.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(app(page).getByText('What does it show?')).toBeVisible();
  await app(page).getByRole('button', { name: 'Delivery proof' }).click();
  await expect(page.locator('#toast')).toHaveText('Added to your case file');
  await expect(app(page).getByText('5 of 5 ready')).toBeVisible();
  await expect(app(page).getByText('Ordered, paid and delivered')).toBeVisible();
  await expect(screen(page).getByLabel('E5: Delivery proof')).toBeVisible();
});

const lum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  return (r * 299 + g * 587 + b * 114) / 1000;
};
const screenColors = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.screen:not(.leaving)');
    const card = el.querySelector('.card');
    return { bg: getComputedStyle(el).backgroundColor, card: getComputedStyle(card).backgroundColor, ink: getComputedStyle(card).color, page: getComputedStyle(document.body).backgroundColor };
  });

test('light by default, even when the device is set to dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openHold(page);
  const colors = await screenColors(page);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  expect(lum(colors.bg)).toBeGreaterThan(230);
  expect(lum(colors.page)).toBeGreaterThan(220);
  expect(lum(colors.ink)).toBeLessThan(60);
});

test('dark theme renders with dark surfaces and light text when chosen in the rail', async ({ page, isMobile }) => {
  await openHold(page);
  if (isMobile) await page.getByRole('button', { name: 'Demo controls', exact: true }).click();
  await page.locator('#rail').getByRole('button', { name: 'Dark', exact: true }).click();
  if (isMobile) await page.keyboard.press('Escape');
  await expect(page.locator('#rail [data-action="theme"][data-arg="dark"]')).toHaveAttribute('aria-pressed', 'true');
  const colors = await screenColors(page);
  expect(lum(colors.bg)).toBeLessThan(40);
  expect(lum(colors.card)).toBeLessThan(50);
  expect(lum(colors.ink)).toBeGreaterThan(200);
});

test('the rail reports when the open model is not connected', async ({ page, isMobile }) => {
  await page.route('**/api/health', (route) => route.fulfill({ contentType: 'application/json', body: '{"ok":true,"ai":false,"model":"gpt-oss-120b"}' }));
  await page.goto('/');
  if (isMobile) await app(page).getByRole('button', { name: 'Demo controls', exact: true }).click();
  await expect(page.locator('#ai-status-text')).toContainText('Open model not connected yet');
  await page.locator('#rail').getByRole('button', { name: 'Scripted' }).click();
  await expect(page.locator('#ai-status-text')).toHaveText('Scripted: instant and the same every time. Best for recording.');
});

test('the phone UI never shows the Razorpay name and carries the concept disclaimers', async ({ page }) => {
  await page.goto('/');
  const phoneText = await page.locator('#phone').innerText();
  expect(phoneText).not.toMatch(/razorpay/i);
  await expect(page.locator('.strip-label')).toHaveText(/Concept · fictional data/i);
  await expect(page.locator('#rail .fine')).toContainText('not a Razorpay product');
});
