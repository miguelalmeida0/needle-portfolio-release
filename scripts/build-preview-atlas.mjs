import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// A delivery derivative of the frozen 120 previews, never a replacement corpus.
// One immutable request paints the map instead of 120 lazy image requests.
export async function buildPreviewAtlas() {
  const pointer = JSON.parse(await fs.readFile('data-packs/active.json', 'utf8'));
  const corpus = JSON.parse(await fs.readFile(`data-packs/${pointer.packId}/corpus.json`, 'utf8'));
  const items = corpus.items.filter(item => item.previewRank).sort((a, b) => a.previewRank - b.previewRank);
  const columns = 10, rows = Math.ceil(items.length / columns), width = 164, height = 208;
  const tiles = [];
  for (const [index, item] of items.entries()) {
    const source = item.thumbnailUrl ?? item.imageUrl;
    if (!source.startsWith(`/packs/${pointer.packId}/images/`) || source.includes('..')) throw new Error('Nonlocal atlas source');
    const input = await sharp(path.join('data-packs', source.slice('/packs/'.length))).rotate()
      .resize(width, height, { fit: 'cover' }).raw().toBuffer({ resolveWithObject: true });
    tiles.push({ input: input.data, raw: { width, height, channels: input.info.channels }, left: index % columns * width, top: Math.floor(index / columns) * height });
  }
  const bytes = await sharp({ create: { width: columns * width, height: rows * height, channels: 3, background: '#efeee8' } })
    .composite(tiles).avif({ quality: 45, effort: 3 }).toBuffer();
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8).toUpperCase();
  const url = `/packs/${pointer.packId}/previews/atlas-${hash}.avif`;
  const entries = Object.fromEntries(items.map((item, index) => [item.thumbnailUrl ?? item.imageUrl, index]));
  return { bytes, url, filePath: 'data-packs/' + url.slice('/packs/'.length), manifest: { url, columns, rows, entries } };
}
