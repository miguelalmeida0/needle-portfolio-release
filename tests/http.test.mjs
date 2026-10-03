import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('HTTP boundaries, cache headers and conditional requests', async t => {
  const cache = await fs.mkdtemp(path.join(os.tmpdir(), 'needle-http-'));
  const child = spawn(process.execPath, ['scripts/serve.mjs', '--packs', 'data-packs', '--host', '127.0.0.1', '--port', '0'], { env: { ...process.env, NEEDLE_IMAGE_CACHE_ROOT: cache }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { child.kill(); await once(child, 'exit'); await fs.rm(cache, { recursive: true, force: true }); });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited: ${code}`)));
    child.stdout.on('data', bytes => { output += bytes; const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]); });
  });
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('cache-control'), 'no-store');
  await home.arrayBuffer();
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/_image?src=http://127.0.0.1/private&w=160&format=avif`)).status, 404);
  assert.equal((await fetch(`${base}/packs/not-active/images/1.jpg`)).status, 404);
  const corpus = await fetch(`${base}/data/corpus.json`, { method: 'HEAD' });
  assert.equal(corpus.headers.get('cache-control'), 'no-cache');
  const image = `${base}/_image?src=%2Fpacks%2Fmet-10k-lean-v2%2Fimages%2F921212.jpg&w=160&format=avif`;
  const first = await fetch(image);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.ok((await first.arrayBuffer()).byteLength > 0);
  const repeated = await fetch(image, { headers: { 'If-None-Match': first.headers.get('etag') } });
  assert.equal(repeated.status, 304);
  assert.equal((await repeated.arrayBuffer()).byteLength, 0);
});
