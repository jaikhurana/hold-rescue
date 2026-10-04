// GET /api/health → { ok, ai, model }. The presenter rail calls this on load to show
// whether the open model is connected. It reports only whether a key is set, never the key.
import { models } from '../lib/models.js';

export function GET() {
  const body = { ok: true, ai: Boolean(process.env.GROQ_API_KEY), model: models()[0].label };
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
