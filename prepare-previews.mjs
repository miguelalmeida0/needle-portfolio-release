// Preserve the normal build's preview preparation in the exported runtime package.
// Uses the unchanged image pipeline; never rebuilds the corpus or graph.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createImageDelivery } from './scripts/image-delivery.mjs';

const pointer = JSON.parse(await fs.readFile('data-packs/active.json', 'utf8'));
const pack = path.resolve('data-packs', pointer.packId);
const corpus = JSON.parse(await fs.readFile(path.join(pack, 'corpus.json'), 'utf8'));
const prefix = `/packs/${pointer.packId}/`;
const deliver = createImageDelivery({
  cacheRoot: process.env.NEEDLE_IMAGE_CACHE_ROOT ?? path.resolve('.needle-cache/derivatives'),
  resolveLocal: async source => source.startsWith(prefix) && !source.includes('..')
    ? path.join(pack, source.slice(prefix.length)) : null,
});
const previews = corpus.items.filter(item => item.previewRank &&
  (item.thumbnailUrl ?? item.imageUrl).startsWith(prefix));
if (corpus.items.length !== 10000 || previews.length !== 120) {
  throw new Error('Expected the frozen 10K Met pack with 120 local previews');
}
for (let start = 0; start < previews.length; start += 3) {
  await Promise.all(previews.slice(start, start + 3).map(async item => {
    const source = item.thumbnailUrl ?? item.imageUrl;
    // Match the unchanged ArtworkImage srcset, including retina map tiles and
    // the larger collection wall. No first visitor should generate these files.
    for (const width of [160, 320, 640]) {
      const result = await deliver(new URL(`http://localhost/_image?src=${encodeURIComponent(source)}&w=${width}&format=avif`));
      if (!result || result.stats.size === 0) throw new Error(`Preview failed: ${item.id}/${width}`);
    }
  }));
}
console.log(`Prepared ${previews.length} local previews at 160/320/640px (${previews.length * 3} cached derivatives) using the existing image pipeline.`);
