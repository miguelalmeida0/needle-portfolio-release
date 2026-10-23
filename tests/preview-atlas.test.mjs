import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

test('opening pictures render before the search catalogue exists and need no image requests', async () => {
  const { transform } = await import('esbuild');
  const corpus = JSON.parse(await readFile('data-packs/met-10k-lean-v2/corpus.json', 'utf8'));
  const expected = corpus.items.filter(item => item.previewRank != null && item.previewRank < 120).slice(0, 12);
  const homePreviews = await readFile('src/redesign/home-previews.json', 'utf8')
    .then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return { artworks: [] }; throw error; });
  const source = await readFile('src/redesign/NeedleApp.jsx', 'utf8');
  const component = (await transform(source.slice(source.indexOf('function HomeBackdrop(')), { loader: 'jsx' })).code;
  const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
  const HomeBackdrop = new Function('React', 'useMemo', 'ArtworkImage', 'homePreviews', component + '\nreturn HomeBackdrop;')(
    React, callback => callback(), () => {}, homePreviews);
  const initial = HomeBackdrop({ items: [] });
  const pictures = initial.children[0];
  assert.equal(pictures.length, 12, 'all opening pictures must exist while the catalogue is unavailable');
  assert.equal(initial.props['aria-hidden'], 'true', 'decoration stays outside the accessibility tree');
  assert.deepEqual(pictures.map(picture => picture.props.key), expected.map(item => item.id), 'preserve the exact original twelve artworks and order');
  let bytes = 0;
  for (const picture of pictures) {
    const image = picture.children[0];
    assert.equal(image.type, 'img');
    assert.equal(image.props.loading, 'eager');
    assert.match(image.props.src, /^data:image\/webp;base64,/, 'opening must not wait for HTTP, transforms or the museum');
    const encoded = Buffer.from(image.props.src.split(',')[1], 'base64');
    const metadata = await sharp(encoded).metadata();
    assert.equal(metadata.width, 140);
    assert.equal(metadata.height, 176);
    bytes += encoded.length;
  }
  assert.ok(bytes < 48000, 'the twelve inline pictures have a 48 KB combined image budget');
});

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
