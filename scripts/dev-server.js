// Local dev server. Serves the static files and runs api/*.js the same way Vercel does:
// a Web Request goes in and a Web Response (possibly streamed) comes out.
// Run: npm run dev   (loads GROQ_API_KEY from .env.local if the file exists)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const API = new Set(['draft', 'health']);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade']);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const api = url.pathname.match(/^\/api\/([a-z]+)\/?$/);
    if (api) await runApi(api[1], url, req, res);
    else await serveStatic(url.pathname, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Hold Rescue on http://localhost:${PORT} · AI key ${process.env.GROQ_API_KEY ? 'set' : 'missing'}`);
});

async function runApi(name, url, req, res) {
  if (!API.has(name)) return void res.writeHead(404).end();
  const mod = await import(`../api/${name}.js`);
  const handler = mod[req.method];
  let response;
  if (typeof handler !== 'function') {
    response = new Response(null, { status: 405 });
  } else {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(k)) headers.set(k, String(v));
    headers.set('x-forwarded-for', req.socket.remoteAddress ?? '127.0.0.1');
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(url, {
      method: req.method,
      headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: 'half',
    });
    response = await handler(request);
  }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) for await (const chunk of response.body) res.write(chunk);
  res.end();
}

async function serveStatic(pathname, res) {
  let path = decodeURIComponent(pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  const rel = file.slice(ROOT.length);
  // Never serve dotfiles (.env.local), anything outside the project, or node_modules.
  const blocked = !file.startsWith(ROOT) || rel.split(sep).some((p) => p.startsWith('.') || p === 'node_modules');
  if (blocked) return void res.writeHead(404).end('Not found');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}
