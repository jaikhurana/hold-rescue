// Browser client for POST /api/draft. Reads the server-sent events as they stream in.
// Gives up if no text arrives within 30 s, or after 90 s in total; the caller then shows
// the scripted statement, so the merchant is never left at a dead end.

const FIRST_TOKEN_MS = 30_000;
const TOTAL_MS = 90_000;

/**
 * @param {{lang: 'en'|'hi', variant: ''|'shorter', fresh: boolean, e5: null|object}} params
 * @param {{signal?: AbortSignal, onText?: (raw: string, model: string) => void}} options
 * @returns {Promise<{text: string, model: string, cached: boolean}>} rejects on any failure
 */
export async function streamDraft(params, { signal, onText } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const firstTimer = setTimeout(abort, FIRST_TOKEN_MS);
  const totalTimer = setTimeout(abort, TOTAL_MS);
  try {
    const res = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`http_${res.status}`);
    const model = res.headers.get('x-model-label') || 'gpt-oss-120b';
    const cached = res.headers.get('x-cache') === 'hit';
    let raw = '';
    for await (const data of sseData(res.body)) {
      if (data === '[DONE]') return { text: raw, model, cached };
      const event = JSON.parse(data);
      if (event.error) throw new Error(event.error);
      if (typeof event.response === 'string' && event.response) {
        clearTimeout(firstTimer);
        raw += event.response;
        onText?.(raw, model);
      }
    }
    throw new Error('stream_ended_early');
  } finally {
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
    signal?.removeEventListener('abort', abort);
  }
}

/** Yields the `data:` payload of each server-sent event, handling events split across chunks. */
async function* sseData(body) {
  const reader = body.getReader(); // a reader loop, because Safari can't for-await a ReadableStream
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) yield data;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
