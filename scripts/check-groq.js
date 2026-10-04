// Checks the Groq key, model availability and streaming, without printing the key.
// Run: node --env-file=.env.local scripts/check-groq.js
const BASE = 'https://api.groq.com/openai/v1';
const WANTED = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const key = process.env.GROQ_API_KEY;

if (!key) {
  console.log('GROQ_API_KEY: missing');
  process.exit(1);
}
console.log('GROQ_API_KEY: set');

const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' };

const list = await fetch(`${BASE}/models`, { headers });
if (!list.ok) {
  console.log(`GET /models -> ${list.status}`);
  process.exit(1);
}
const ids = (await list.json()).data.map((m) => m.id).sort();
console.log(`GET /models -> ${list.status}, ${ids.length} models`);
console.log('gpt-oss models:', ids.filter((id) => id.includes('gpt-oss')).join(', ') || 'none');
for (const id of WANTED) console.log(`  ${id}: ${ids.includes(id) ? 'available' : 'MISSING'}`);

for (const model of WANTED.filter((id) => ids.includes(id))) {
  const started = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      reasoning_effort: 'low',
      include_reasoning: false,
      max_completion_tokens: 200,
      temperature: 0.3,
      messages: [{ role: 'user', content: 'Reply with exactly this sentence: Hold Rescue is connected.' }],
    }),
  });
  console.log(`\nPOST ${model} -> ${res.status} ${res.headers.get('content-type')}`);
  if (!res.ok) {
    console.log((await res.text()).slice(0, 300));
    continue;
  }
  const limits = ['x-ratelimit-limit-requests', 'x-ratelimit-limit-tokens', 'x-ratelimit-remaining-requests']
    .map((h) => `${h.replace('x-ratelimit-', '')}=${res.headers.get(h)}`)
    .join(' ');
  console.log(`  limits: ${limits}`);

  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let firstToken = 0;
  let reasoningDeltas = 0;
  let events = 0;
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      events++;
      const delta = JSON.parse(data).choices?.[0]?.delta ?? {};
      if (delta.reasoning) reasoningDeltas++;
      if (delta.content) {
        if (!firstToken) firstToken = Date.now() - started;
        text += delta.content;
      }
    }
  }
  console.log(`  events=${events} reasoningDeltas=${reasoningDeltas} firstToken=${firstToken}ms total=${Date.now() - started}ms`);
  console.log(`  text: ${JSON.stringify(text)}`);
}
