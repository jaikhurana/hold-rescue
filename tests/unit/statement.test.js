// Unit tests for the browser's pure text functions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanCallBrief, cleanDraft, parseCallBrief, scriptedAgentDraft, scriptedStatement, typedSlice, wordCount } from '../../statement.js';

const ALL = new Set(['E1', 'E2', 'E3', 'E4', 'E5']);
const NO_E5 = new Set(['E1', 'E2', 'E3', 'E4']);

test('cleanDraft strips preambles, markdown and wrapping quotes', () => {
  assert.equal(cleanDraft('Here is the statement:\n\n"I run **Kesar Kurtas** [E1]."', ALL), 'I run Kesar Kurtas [E1].');
  assert.equal(cleanDraft("Sure, here's a draft: I run Kesar Kurtas.", ALL), 'I run Kesar Kurtas.');
  assert.equal(cleanDraft('# Statement\nI run Kesar Kurtas.', ALL), 'Statement I run Kesar Kurtas.');
  assert.equal(cleanDraft('“I run Kesar Kurtas.”', ALL), 'I run Kesar Kurtas.');
});

test('cleanDraft joins lines into one paragraph', () => {
  assert.equal(cleanDraft('First line [E1].\n\nSecond line [E2].', ALL), 'First line [E1]. Second line [E2].');
});

test('cleanDraft normalises tag groups into one tag each', () => {
  assert.equal(cleanDraft('Paid and ordered [E1, E2].', ALL), 'Paid and ordered [E1][E2].');
  assert.equal(cleanDraft('Paid and ordered [E1,E2].', ALL), 'Paid and ordered [E1][E2].');
  assert.equal(cleanDraft('Paid and ordered [E1 and E2].', ALL), 'Paid and ordered [E1][E2].');
  assert.equal(cleanDraft('Everything [E1–E3].', ALL), 'Everything [E1][E2][E3].');
  assert.equal(cleanDraft('Delivered 【E3】.', ALL), 'Delivered [E3].');
  assert.equal(cleanDraft('Delivered (E3).', ALL), 'Delivered [E3].');
  assert.equal(cleanDraft('Delivered [ e3 ].', ALL), 'Delivered [E3].');
});

test('cleanDraft drops tags for evidence that is not in the case file', () => {
  assert.equal(cleanDraft('The chat [E5]. Made up [E9].', NO_E5), 'The chat. Made up.');
  assert.equal(cleanDraft('Mixed [E4, E5].', NO_E5), 'Mixed [E4].');
});

test('cleanDraft moves tags written after the full stop to before it', () => {
  assert.equal(cleanDraft('Delivered with OTP. [E3] Our policy. [E4]', ALL), 'Delivered with OTP [E3]. Our policy [E4].');
  assert.equal(cleanDraft('OTP से पुष्टि की। [E3]', ALL), 'OTP से पुष्टि की [E3]।');
});

test('cleanDraft removes the space left before punctuation and fixes non-breaking hyphens', () => {
  assert.equal(cleanDraft('Order KK‑2417 was paid [E1] .', ALL), 'Order KK-2417 was paid [E1].');
  assert.equal(cleanDraft('पुष्टि की [E3] ।', ALL), 'पुष्टि की [E3]।');
  assert.equal(cleanDraft('Paid , delivered .', ALL), 'Paid, delivered.');
});

test('scriptedStatement follows the brief: chat, no chat and attached screenshot', () => {
  const chat = scriptedStatement('en', '', { kind: 'chat' });
  assert.match(chat, /^I run Kesar Kurtas/);
  assert.match(chat, /On 19 Sep the customer asked to exchange it for size L \[E5\]\./);
  assert.match(chat, /This is a dispute about an exchange, not a fraud/);
  assert.ok(!chat.includes('we offer exchanges under this policy'));

  const none = scriptedStatement('en', '', null);
  assert.ok(!none.includes('[E5]'));
  assert.match(none, /we offer exchanges under this policy, so this is not a fraud/);

  const exchangeTag = scriptedStatement('en', '', { kind: 'tag', tag: "Customer's exchange request" });
  assert.match(exchangeTag, /I have attached a screenshot of our conversation \[E5\]\./);
  const otherTag = scriptedStatement('en', '', { kind: 'tag', tag: 'Delivery proof' });
  assert.match(otherTag, /I have also attached a screenshot from my phone \[E5\]\./);
  assert.ok(!otherTag.includes('our conversation'));
});

test('scriptedStatement: shorter and Hindi versions', () => {
  assert.match(scriptedStatement('en', 'shorter', { kind: 'chat' }), /refused the ₹120 return courier charge/);
  assert.match(scriptedStatement('en', 'shorter', { kind: 'tag', tag: "Customer's exchange request" }), /A screenshot of our conversation is attached \[E5\]\.$/);
  const hi = scriptedStatement('hi', '', { kind: 'chat' });
  assert.match(hi, /^मैं जयपुर में केसर कुर्ताज़/);
  assert.match(hi, /धोखाधड़ी नहीं/);
  assert.ok(wordCount(scriptedStatement('hi', 'shorter', null)) < wordCount(hi));
});

test('the full English scripted statement with the chat is about 140 words', () => {
  const words = wordCount(scriptedStatement('en', '', { kind: 'chat' }));
  assert.ok(words >= 130 && words <= 150, `got ${words}`);
});

test('typedSlice never cuts a tag in half', () => {
  const text = 'Delivered [E3]. Policy [E4].';
  assert.equal(typedSlice(text, 11), 'Delivered [E3]');
  assert.equal(typedSlice(text, 13), 'Delivered [E3]');
  assert.equal(typedSlice(text, 15), 'Delivered [E3].');
  assert.equal(typedSlice(text, 5), 'Deliv');
});

test('wordCount ignores tags', () => {
  assert.equal(wordCount('Paid by UPI [E1][E2].'), 3);
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount(undefined), 0);
});

// ───────────── Follow-up agent drafts ─────────────

test('agent fallbacks match the brief word for word when the chat is in the file', () => {
  assert.equal(
    scriptedAgentDraft('officer_reply', 'en', { kind: 'chat' }),
    "Thank you for your message. As requested, I am sharing the proof of delivery and the customer's messages about the exchange. The order was delivered on 18 Sep 2026 and the recipient confirmed delivery with an OTP [E3]. On 19 Sep the customer asked to exchange size M for L and refused the ₹120 return courier charge in our published policy [E4][E5]. I am happy to join a video call at your convenience, and I request that the hold of ₹1,800 be released.",
  );
  assert.equal(
    scriptedAgentDraft('escalation', 'en', { kind: 'chat' }),
    'I request a review of the hold of ₹1,800 on order KK-2417. My grievance was filed on the national grievance portal on 6 Oct 2026, and no decision has been shared within 15 days. The order was paid for, delivered with OTP confirmation and is covered by our published exchange policy [E1][E3][E4]. The complaint arose from a disagreement about a ₹120 return courier charge [E5]. I request that the hold be reviewed and released.',
  );
});

test('agent fallbacks never claim proof that is not in the file', () => {
  const reply = scriptedAgentDraft('officer_reply', 'en', null);
  assert.ok(!reply.includes('[E5]') && !reply.includes("customer's messages about the exchange"));
  assert.match(reply, /I will share the customer's messages as soon as I can\./);
  assert.ok(!scriptedAgentDraft('escalation', 'en', null).includes('[E5]'));
  const tagged = scriptedAgentDraft('officer_reply', 'en', { kind: 'tag', tag: 'Delivery proof' });
  assert.match(tagged, /I have also attached a screenshot from my phone \[E5\]\./);
  assert.ok(!scriptedAgentDraft('call_brief', 'en', null).includes('[E5]'));
  for (const kind of ['officer_reply', 'escalation', 'call_brief']) {
    assert.match(scriptedAgentDraft(kind, 'hi', { kind: 'chat' }), /[ऀ-ॿ]/, `${kind} has a Hindi version`);
  }
});

test('the call brief keeps its four-line shape and every answer cites proof', () => {
  const all = new Set(['E1', 'E2', 'E3', 'E4', 'E5']);
  const scripted = scriptedAgentDraft('call_brief', 'en', { kind: 'chat' });
  assert.deepEqual(Object.keys(parseCallBrief(scripted, all)), ['a1', 'a2', 'a3', 'tip']);
  const messy = '**A1:** A kurta set. [E1, E2]  \nA2 - Yes [E3]\n\nA3: Our policy [E4][E9]\nTIP: Say plainly that you will exchange it.';
  assert.equal(cleanCallBrief(messy, all), 'A1: A kurta set [E1][E2].\nA2: Yes [E3]\nA3: Our policy [E4]\nTIP: Say plainly that you will exchange it.');
  assert.equal(parseCallBrief('A1: no proof here\nA2: x [E3]\nA3: y [E4]\nTIP: z', all), null);
  assert.equal(parseCallBrief('A1: x [E1]\nA2: y [E3]\nTIP: z', all), null, 'a missing answer');
});
