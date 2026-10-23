import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// The opening screen must not depend on loading/initializing the full catalogue.
// Tiny inline derivatives share the bootstrap's immutable cache entry and make
// no separate image requests. Original pack images remain untouched.
export async function buildHomePreviews() {
  const pointer = JSON.parse(await fs.readFile('data-packs/active.json', 'utf8'));
  if (!/^[a-z0-9-]+$/.test(pointer.packId)) throw new Error('Invalid opening pack ID');
  const corpus = JSON.parse(await fs.readFile(`data-packs/${pointer.packId}/corpus.json`, 'utf8'));
  // Preserve the existing HomeBackdrop's exact artwork selection and order.
  const items = corpus.items.filter(item => item.previewRank != null && item.previewRank < 120).slice(0, 12);
  if (items.length !== 12) throw new Error('Opening screen requires twelve real previews');
  const artworks = [];
  let totalBytes = 0;
  for (const item of items) {
    const source = item.thumbnailUrl || item.imageUrl;
    if (!source.startsWith(`/packs/${pointer.packId}/images/`) || source.includes('..')) throw new Error('Nonlocal opening preview');
    const bytes = await sharp(path.join('data-packs', source.slice('/packs/'.length)))
      .rotate().resize(140, 176, { fit: 'cover' }).webp({ quality: 64, effort: 4 }).toBuffer();
    totalBytes += bytes.length;
    artworks.push({ id: item.id, source, width: 140, height: 176, src: `data:image/webp;base64,${bytes.toString('base64')}` });
  }
  if (totalBytes > 48000) throw new Error('Opening pictures exceed the combined 48 KB budget');
  return { artworks };
}

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
