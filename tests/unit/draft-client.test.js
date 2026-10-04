// Unit tests for the browser's streaming client, with /api/draft replaced by a mocked fetch.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { streamDraft } from '../../draft-client.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function serve(text, { status = 200, headers = {}, chunkSize = 4 } = {}) {
  const bytes = new TextEncoder().encode(text);
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/draft');
    assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(), ['e5', 'fresh', 'lang', 'variant']);
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
        controller.close();
      },
    });
    return new Response(body, { status, headers: { 'content-type': 'text/event-stream', ...headers } });
  };
}

const params = { lang: 'en', variant: '', fresh: false, e5: { kind: 'chat' } };
const event = (piece) => `data: ${JSON.stringify({ response: piece })}\n\n`;

test('reads events split across chunks and reports progress', async () => {
  serve(`${event('Paid ₹1,800 ')}${event('by UPI [E1].')}data: [DONE]\n\n`, { headers: { 'x-model-label': 'gpt-oss-20b', 'x-cache': 'hit' } });
  const seen = [];
  const result = await streamDraft(params, { onText: (raw) => seen.push(raw) });
  assert.deepEqual(result, { text: 'Paid ₹1,800 by UPI [E1].', model: 'gpt-oss-20b', cached: true });
  assert.deepEqual(seen, ['Paid ₹1,800 ', 'Paid ₹1,800 by UPI [E1].']);
});

test('fails on an error status, an error event, or a stream that ends without [DONE]', async () => {
  serve('{"error":"api_key_missing"}', { status: 503 });
  await assert.rejects(streamDraft(params), /http_503/);

  serve(`${event('Partial')}data: {"error":"stream_interrupted"}\n\n`);
  await assert.rejects(streamDraft(params), /stream_interrupted/);

  serve(event('Cut off'));
  await assert.rejects(streamDraft(params), /stream_ended_early/);
});

test('can be aborted by the caller', async () => {
  globalThis.fetch = (url, init) =>
    new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  const controller = new AbortController();
  const pending = streamDraft(params, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /Abort/);
});
