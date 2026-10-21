import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

// Regression: the clear-search map used 120 independent image requests.
// Value: protects=all bundled map artworks share one immutable delivery asset;
// fails_when=atlas loses identity or falls back to per-tile transforms;
// why_new=previous cache tests only checked derivatives; seam=none;
// no_claim=network latency (checked in the live browser separately).
test('every bundled artwork has the correct real image in one static atlas', async () => {
  const { buildPreviewAtlas } = await import('../scripts/build-preview-atlas.mjs');
  const atlas = await buildPreviewAtlas();
  const saved = JSON.parse(await readFile('src/redesign/preview-atlas.json', 'utf8'));
  assert.deepEqual(saved, atlas.manifest);
  assert.deepEqual(await readFile(atlas.filePath), atlas.bytes);
  const corpus = JSON.parse(await readFile('data-packs/met-10k-lean-v2/corpus.json', 'utf8'));
  const items = corpus.items.filter(item => item.previewRank).sort((a,b) => a.previewRank-b.previewRank);
  assert.equal(Object.keys(saved.entries).length, 120);
  for (const [index, item] of items.entries()) assert.equal(saved.entries[item.thumbnailUrl], index);
  const meta = await sharp(atlas.bytes).metadata();
  assert.equal(meta.width, saved.columns * 164);
  assert.equal(meta.height, saved.rows * 208);
  assert.ok(atlas.bytes.length < 350000, 'entire sheet has a bounded transfer budget');
  assert.match(await readFile('src/redesign/GalleryImage.jsx', 'utf8'), /role === 'map'/);
  assert.match(await readFile('src/redesign/CategoryMap.jsx', 'utf8'), /role="map"/);
});

// Exercise the actual presentation boundary, including each source/crop and the
// non-bundled path; this is a request-budget test, not a latency simulation.
test('all 120 map tiles use one request without changing remote gallery sources', async () => {
  const { transform } = await import('esbuild');
  const sizing = await import('../dist/modules/apps/web/src/shared/images/image-sizing.js');
  const manifest = JSON.parse(await readFile('src/redesign/preview-atlas.json'));
  const source = (await transform(await readFile('src/redesign/GalleryImage.jsx', 'utf8'), { loader: 'jsx', format: 'esm' })).code
    .replace(/^import [\s\S]*? from [^;]+;\n/gm, '').replace(/^export \{[\s\S]*?\};?\s*$/m, '');
  const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
  const OptimizedArtworkImage = () => undefined;
  const component = new Function('React', 'useState', 'previewAtlas', 'OptimizedArtworkImage', 'mediumSource', 'imagePriority', 'imageUrl', source + '\nreturn ArtworkImage;')(
    React, initial => [initial, () => {}], manifest, OptimizedArtworkImage, sizing.mediumSource, sizing.imagePriority, sizing.imageUrl);
  const resolve = props => { let node = component(props); while (typeof node.type === 'function' && node.type !== OptimizedArtworkImage) node = node.type(node.props); return node; };
  const requests = new Set();
  for (const [src, index] of Object.entries(manifest.entries)) {
    const tile = resolve({ src, role: 'map', alt: 'Real artwork' });
    assert.equal(tile.type, 'span');
    const image = tile.children[0];
    requests.add(image.props.src);
    assert.equal(image.props.alt, 'Real artwork');
    assert.equal(image.props.style.left, `${-(index % manifest.columns) * 100}%`);
    assert.equal(image.props.style.top, `${-Math.floor(index / manifest.columns) * 100}%`);
  }
  assert.deepEqual([...requests], [manifest.url]);
  const remote = 'https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg';
  assert.equal(resolve({ src: remote, role: 'map' }).props.src, remote);
  assert.equal(component({ src: Object.keys(manifest.entries)[0], role: 'detail' }).type, OptimizedArtworkImage);
});
