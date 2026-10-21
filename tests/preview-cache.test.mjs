import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createImageDelivery } from '../scripts/image-delivery.mjs';

const root = new URL('../', import.meta.url);
// Regression: ISSUE-002 — retina map thumbnails missed the build-time cache.
// Found by /qa on 2026-10-21. See docs/needle-qa-scroll-images.md.
test('a fresh preview build warms every local image at all rendered thumbnail sizes', async t => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), 'needle-preview-cache-'));
  t.after(() => rm(cacheRoot, { recursive: true, force: true }));
  await promisify(execFile)(process.execPath, ['prepare-previews.mjs'], {
    cwd: root, env: { ...process.env, NEEDLE_IMAGE_CACHE_ROOT: cacheRoot }, timeout: 120000,
  });
  const prepared = new Set(await readdir(cacheRoot));
  assert.equal(prepared.size, 360, '120 real local images × 160/320/640px must already be cached');
  const corpus = JSON.parse(await readFile(new URL('data-packs/met-10k-lean-v2/corpus.json', root)));
  const previews = corpus.items.filter(item => item.previewRank && item.thumbnailUrl?.startsWith('/packs/'));
  const deliver = createImageDelivery({ cacheRoot, resolveLocal: async source => new URL('data-packs/' + source.slice('/packs/'.length), root).pathname });
  for (const item of previews) {
    for (const width of [160, 320, 640]) {
      const result = await deliver(new URL(`http://localhost/_image?src=${encodeURIComponent(item.thumbnailUrl)}&w=${width}&format=avif`));
      assert.ok(prepared.has(path.basename(result.filePath)), `${item.id}/${width} must be a hit before the first visitor`);
    }
  }
  assert.equal((await readdir(cacheRoot)).length, prepared.size, 'the first retina map visit generates no local derivatives');
});
