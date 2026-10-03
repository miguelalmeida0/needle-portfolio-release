import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createImageDelivery, remoteImageSource } from '../scripts/image-delivery.mjs';

test('remote sources reject credentials, redirects to other hosts and arbitrary paths', () => {
  assert.ok(remoteImageSource('https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg'));
  for (const source of ['http://images.metmuseum.org/CRDImages/ep/web-large/example.jpg', 'https://images.metmuseum.org.evil.test/CRDImages/ep/web-large/example.jpg', 'https://user:pass@images.metmuseum.org/CRDImages/ep/web-large/example.jpg', 'https://images.metmuseum.org:444/CRDImages/ep/web-large/example.jpg', 'https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg?q=1', 'https://images.metmuseum.org/private', 'http://127.0.0.1/admin']) assert.equal(remoteImageSource(source), false);
});

test('derivatives share overlapping requests, preserve identity and reject unsupported transforms', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'needle-images-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source.jpg');
  await sharp({ create: { width: 400, height: 240, channels: 3, background: '#183c31' } }).jpeg().toFile(source);
  const delivery = createImageDelivery({ cacheRoot: path.join(dir, 'cache'), resolveLocal: async value => value === '/packs/test/images/1.jpg' ? source : null });
  const url = new URL('http://localhost/_image?src=%2Fpacks%2Ftest%2Fimages%2F1.jpg&w=160&format=avif');
  const [a, b] = await Promise.all([delivery(url), delivery(url)]);
  assert.equal(a.filePath, b.filePath);
  assert.equal(a.etag, b.etag);
  assert.ok(a.stats.size > 0);
  assert.equal((await sharp(a.filePath).metadata()).width, 160);
  const later = await delivery(url);
  assert.equal(later.stats.mtimeMs, a.stats.mtimeMs, 'A cache hit should not regenerate the file');
  const changedWidth = new URL(url); changedWidth.searchParams.set('w', '320');
  assert.notEqual((await delivery(changedWidth)).etag, a.etag);
  const changedFormat = new URL(url); changedFormat.searchParams.set('format', 'webp');
  assert.notEqual((await delivery(changedFormat)).etag, a.etag);
  const unsupported = new URL(url); unsupported.searchParams.set('w', '123');
  assert.equal(await delivery(unsupported), null);
  const unsafe = new URL(url); unsafe.searchParams.set('src', 'http://127.0.0.1/private');
  assert.equal(await delivery(unsafe), null);
  await fs.utimes(source, new Date(), new Date(Date.now() + 5000));
  assert.notEqual((await delivery(url)).etag, a.etag, 'A changed local source must produce another derivative identity');
});
