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

test('remote URL fragments cannot multiply identical source cache entries', () => {
  assert.equal(remoteImageSource('https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg#cache-buster'), false);
  assert.equal(remoteImageSource('https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg#'), false);
});

test('local aliases share one canonical cache entry and exhausted work budgets still serve it', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'needle-images-budget-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source.jpg');
  await sharp({ create: { width: 400, height: 240, channels: 3, background: '#183c31' } }).jpeg().toFile(source);
  let remaining = 1;
  const delivery = createImageDelivery({ cacheRoot: path.join(dir, 'cache'), resolveLocal: async () => source,
    budget: { reserveTransform() { if (remaining-- <= 0) throw Object.assign(new Error('Budget exhausted'), { statusCode: 429 }); } }
  });
  const url = new URL('http://localhost/_image?src=/packs/test/images/1.jpg&w=160&format=webp');
  const first = await delivery(url);
  const alias = new URL(url); alias.searchParams.set('src', '/packs/test/images/%31.jpg');
  assert.equal((await delivery(alias)).etag, first.etag, 'The resolved local file, not a caller spelling, identifies cached work');
  const cold = new URL(url); cold.searchParams.set('w', '320');
  await assert.rejects(delivery(cold), error => error.statusCode === 429);
  assert.equal((await delivery(url)).etag, first.etag, 'Quota exhaustion does not remove cached images');
});

test('cold HEAD lookups and disabled remote transforms do not start remote work', async () => {
  const delivery = createImageDelivery({ cacheRoot: '/nonexistent-needle-cache', resolveLocal: async () => null, remoteEnabled: false });
  const url = new URL('http://localhost/_image?src=https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg&w=160&format=webp');
  assert.equal(await delivery(url, { create: false }), null);
  await assert.rejects(delivery(url), error => error.statusCode === 503);
});

test('equivalent museum URL encodings share downloaded bytes and derivative identity', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'needle-remote-alias-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const bytes = await sharp({ create: { width: 200, height: 120, channels: 3, background: '#183c31' } }).png().toBuffer();
  const requests = [];
  const delivery = createImageDelivery({ cacheRoot: dir, resolveLocal: async () => null, fetchRemote: async (url, options) => {
    requests.push(url); assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
    return new Response(bytes, { headers: { 'content-type': 'image/png' } });
  } });
  const url = new URL('http://localhost/_image?src=https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg&w=160&format=webp');
  const first = await delivery(url);
  const alias = new URL(url); alias.searchParams.set('src', 'https://IMAGES.METMUSEUM.ORG/CRDImages/ep/web-large/%65xample.jpg');
  assert.equal((await delivery(alias)).etag, first.etag);
  assert.equal(requests.length, 1);
  const duplicate = new URL(url); duplicate.searchParams.append('w', '320');
  assert.equal(await delivery(duplicate), null);
});

test('three active image jobs bound source work and queued requests expire', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'needle-image-queue-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const bytes = await sharp({ create: { width: 200, height: 120, channels: 3, background: '#183c31' } }).png().toBuffer();
  const releases = [];
  const delivery = createImageDelivery({ cacheRoot: dir, resolveLocal: async () => null, queueWaitMs: 20,
    fetchRemote: async () => new Promise(resolve => releases.push(() => resolve(new Response(bytes, { headers: { 'content-type': 'image/png' } }))))
  });
  const url = n => new URL(`http://localhost/_image?src=https://images.metmuseum.org/CRDImages/ep/web-large/fixture-${n}.jpg&w=160&format=webp`);
  const active = [1, 2, 3].map(n => delivery(url(n)));
  try {
    const deadline = Date.now() + 2000;
    while (releases.length < 3 && Date.now() < deadline) await new Promise(resolve => setImmediate(resolve));
    assert.equal(releases.length, 3);
    await assert.rejects(delivery(url(4)), error => error.statusCode === 503);
    assert.equal(releases.length, 3, 'Expired work must not open another museum request');
  } finally { for (const release of releases) release(); }
  assert.equal((await Promise.all(active)).length, 3);
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
