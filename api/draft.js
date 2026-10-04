// POST /api/draft: drafts the merchant's statement with an open model on Groq and streams it back.
//
// This is a public URL on a free quota, so it can only ever draft this one statement:
//  · the browser may send only { lang, variant, fresh, e5 }; each field is whitelisted, anything else is dropped
//  · bodies over 2 KB are refused before they are parsed
//  · the prompt is built here from the fixed facts in case-data.js; no free text from the browser reaches the model
//  · Redraft (fresh) skips the cache, so it is capped per visitor and per instance
import { E5_LABELS, HOLD, MERCHANT, evidenceFor, isExchangeDispute } from '../case-data.js';
import { models } from '../lib/models.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_BODY_BYTES = 2048;
const UPSTREAM_TIMEOUT_MS = 28_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REDRAFT_WINDOW_MS = 60_000;
const REDRAFTS_PER_VISITOR = 6;
const REDRAFTS_PER_INSTANCE = 30; // Groq's free tier allows 30 requests a minute

const SYSTEM_PROMPT =
  'You draft short, factual statements for small online merchants in India who are answering a police cyber-crime grievance about a held payment. ' +
  'You use only the facts you are given. You never invent facts, names, legal sections or promises. ' +
  'You never accuse the customer of fraud or any crime. ' +
  'You output only the statement text, with no introduction, heading, greeting, sign-off, markdown or quotation marks.';

// In memory, per warm instance.
const cache = new Map(); // cacheKey → { text, label, at }
const redraftsByVisitor = new Map(); // ip → [timestamps]
let redraftsAll = []; // [timestamps]

export function GET() {
  return json(405, { error: 'method_not_allowed' }, { allow: 'POST' });
}

export async function POST(request) {
  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) return json(413, { error: 'body_too_large' });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'bad_json' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'bad_json' });

  const input = normalise(body);
  const key = process.env.GROQ_API_KEY;
  if (!key) return json(503, { error: 'api_key_missing' });

  const cacheKey = cacheKeyFor(input);
  // Over the redraft cap, a Redraft quietly becomes a normal request and gets the saved draft.
  const fresh = input.fresh && allowRedraft(visitorOf(request));
  if (!fresh) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return sse(singleEvent(hit.text), { 'x-model-label': hit.label, 'x-cache': 'hit' });
    }
  }

  const messages = buildMessages(input);
  const deadline = Date.now() + UPSTREAM_TIMEOUT_MS; // one budget shared by every model we try
  for (const model of models()) {
    const upstream = await callGroq(model.id, messages, { ...input, fresh }, key, deadline);
    if (!upstream) continue; // 429, 4xx, 5xx, network error or timeout: try the next model
    // Commit to a model only once it produces text. A reasoning model can spend its whole
    // token budget thinking and return nothing; then the next model gets a turn.
    const pieces = contentPieces(upstream.res.body);
    let first;
    try {
      first = await pieces.next();
    } catch {
      first = { done: true };
    }
    if (first.done) {
      upstream.stop();
      continue;
    }
    const stream = relay(first.value, pieces, upstream, (text) => {
      // Only keep drafts that cite their proof, so a weak draft is never served again.
      if (/\[E\d\]/.test(text)) cache.set(cacheKey, { text, label: model.label, at: Date.now() });
    });
    return sse(stream, { 'x-model-label': model.label, 'x-cache': 'miss' });
  }
  return json(502, { error: 'model_unavailable' });
}

// ───────────── Input ─────────────

/** Keeps only the four known fields, each forced to an allowed value. */
export function normalise(body) {
  const lang = body.lang === 'hi' ? 'hi' : 'en';
  const variant = body.variant === 'shorter' ? 'shorter' : '';
  const fresh = body.fresh === true;
  let e5 = null;
  const raw = body.e5;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.kind === 'chat') e5 = { kind: 'chat' };
    else if (raw.kind === 'tag' && E5_LABELS.includes(raw.tag)) e5 = { kind: 'tag', tag: raw.tag };
  }
  return { lang, variant, fresh, e5 };
}

function cacheKeyFor({ lang, variant, e5 }) {
  const e5Key = !e5 ? 'none' : e5.kind === 'chat' ? 'chat' : `tag:${e5.tag}`;
  return `${lang}|${variant}|${e5Key}`;
}

/** Reads the body as text, giving up (null) as soon as it passes `max` bytes. */
async function readCapped(request, max) {
  if (Number(request.headers.get('content-length')) > max) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

// ───────────── Prompt (built only here, only from case-data.js) ─────────────

export function buildMessages({ lang, variant, e5 }) {
  const items = evidenceFor(e5);
  const tags = items.map((item) => `[${item.id}]`).join(', ');
  const plan = sentencePlan(variant, e5);
  const words = variant === 'shorter' ? '60 to 80' : '110 to 150';
  const language =
    lang === 'hi'
      ? 'Simple, everyday Hindi in Devanagari script. Write the store name as केसर कुर्ताज़ and call the hold रोक (as in ₹1,800 की रोक हटाई जाए). Keep the order number KK-2417, ₹ amounts and tags (like [E3]) exactly as written.'
      : 'Plain, simple English.';

  const user = [
    'Task: draft the merchant’s statement to the investigating officer who is reviewing a hold on the merchant’s payment, asking for the hold to be released.',
    `Language: ${language}`,
    `Voice and form: first person, as the merchant, who is a man${lang === 'hi' ? ' (use masculine verb forms)' : ''}. Calm and factual. One paragraph of ${words} words. Use only the facts listed below.`,
    `Write exactly these ${plan.length} sentences, in this order:`,
    ...plan.map((line, i) => `${i + 1}. ${line}`),
    'Keep it short: the tags point the officer to the proof, so do not copy payment IDs, UTR, AWB or invoice numbers into the text. Write the order number as KK-2417.',
    'Restrictions: do not accuse the customer of anything, and do not name or describe the customer; call them only "the customer".',
    `Tags: give each sentence exactly the tags shown for it in the plan, in square brackets at the end of the sentence, before the full stop. Tags are required. Example: ${
      lang === 'hi' ? '"ऑर्डर 18 सितंबर को डिलीवर हुआ और प्राप्तकर्ता ने OTP से पुष्टि की [E3]।"' : '"It was delivered on 18 Sep, and the recipient confirmed with an OTP [E3]."'
    } Use only these tags: ${tags}. Output only the statement.`,
    '',
    'Facts:',
    `Merchant: ${MERCHANT.fact}`,
    `Hold: ${HOLD.fact}`,
    ...items.map((item) => `[${item.id}] ${item.title}: ${item.fact}`),
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

/**
 * What each sentence covers, and which proof it cites. Leads with the delivery proof and,
 * when the merchant added it, the customer's own exchange request; then says plainly what this is.
 */
function sentencePlan(variant, e5) {
  const chat = e5?.kind === 'chat';
  const attached = e5?.kind === 'tag';
  const plainly = isExchangeDispute(e5)
    ? 'this is a dispute about an exchange and the return courier charge, not a fraud'
    : 'the product was ordered, paid for and delivered, so this is not a fraud';
  if (variant === 'shorter') {
    return [
      'The order was paid for by UPI and delivered, with the recipient confirming by OTP [E1][E2][E3].',
      chat
        ? 'The customer asked to exchange the size but refused the ₹120 return courier charge in the published policy [E4][E5].'
        : attached
          ? 'The published exchange policy, and that a screenshot from your phone is attached [E4][E5].'
          : 'The published exchange policy [E4].',
      `Say plainly that ${plainly}; ask for the hold to be released and offer to join a video call (no tag).`,
    ];
  }
  return [
    'Who you are, and that you are writing about the hold on order KK-2417 (no tag).',
    'The payment and what was ordered [E1][E2].',
    'The delivery, confirmed by the recipient with an OTP [E3].',
    ...(chat ? ['The customer asked to exchange size M for size L [E5].'] : []),
    'The published exchange policy [E4].',
    ...(attached ? ['That a screenshot from your phone is attached [E5].'] : []),
    ...(chat ? ['The customer refused to pay the ₹120 return courier and said they would complain [E5].'] : []),
    `Say plainly that ${plainly} (no tag).`,
    'Ask for the hold to be released and offer to join a video call (no tag).',
  ];
}

// ───────────── Groq ─────────────

/** Starts a streaming request. Resolves to { res, stop } on a 2xx, or null. */
async function callGroq(model, messages, { lang, fresh }, key, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  const stop = () => {
    clearTimeout(timer);
    controller.abort();
  };
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        reasoning_effort: 'low',
        include_reasoning: false,
        max_completion_tokens: lang === 'hi' ? 1400 : 1000,
        temperature: fresh ? 0.8 : 0.3,
      }),
      signal: controller.signal,
    });
    if (res.ok && res.body) return { res, stop, done: () => clearTimeout(timer) };
    await res.body?.cancel();
  } catch {
    // network error or timeout: fall through to the next model
  }
  stop();
  return null;
}

/** Yields the text pieces of a Groq (OpenAI-style) SSE stream. Reasoning deltas are dropped. */
export async function* contentPieces(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        let event;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        if (event.error) throw new Error('upstream_error');
        const piece = event.choices?.[0]?.delta?.content;
        if (typeof piece === 'string' && piece) yield piece;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** Re-emits the model's text as `data: {"response": "<piece>"}` events, then `data: [DONE]`. */
function relay(firstPiece, pieces, upstream, onComplete) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (data) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      let text = firstPiece;
      send(JSON.stringify({ response: firstPiece }));
      try {
        for await (const piece of pieces) {
          text += piece;
          send(JSON.stringify({ response: piece }));
        }
        onComplete(text);
        send('[DONE]');
      } catch {
        send(JSON.stringify({ error: 'stream_interrupted' }));
      } finally {
        upstream.done();
        controller.close();
      }
    },
    cancel() {
      upstream.stop();
    },
  });
}

// ───────────── Redraft cap ─────────────

function visitorOf(request) {
  return request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

function allowRedraft(visitor, now = Date.now()) {
  const since = now - REDRAFT_WINDOW_MS;
  redraftsAll = redraftsAll.filter((t) => t > since);
  const mine = (redraftsByVisitor.get(visitor) ?? []).filter((t) => t > since);
  const allowed = mine.length < REDRAFTS_PER_VISITOR && redraftsAll.length < REDRAFTS_PER_INSTANCE;
  if (allowed) {
    mine.push(now);
    redraftsAll.push(now);
  }
  if (redraftsByVisitor.size > 10_000) redraftsByVisitor.clear(); // memory guard
  redraftsByVisitor.set(visitor, mine);
  return allowed;
}

// ───────────── Responses ─────────────

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function sse(stream, headers) {
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function singleEvent(text) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: text })}\n\ndata: [DONE]\n\n`));
      controller.close();
    },
  });
}

/** For unit tests only: clears the cache and the redraft counters. */
export function _resetForTests() {
  cache.clear();
  redraftsByVisitor.clear();
  redraftsAll = [];
}
