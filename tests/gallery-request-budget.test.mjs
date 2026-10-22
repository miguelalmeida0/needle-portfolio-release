import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build, transform } from 'esbuild';
import { redesignImages } from '../scripts/redesign-images.mjs';
import { mediumSource, imagePriority, imageUrl, imageSrcSet, canResize } from '../dist/modules/apps/web/src/shared/images/image-sizing.js';
import { matchesQueryFilters, scopedCorpusItems, visibleHits } from '../dist/modules/apps/web/src/app/app.selectors.js';
import { wallWindow } from '../dist/modules/apps/web/src/features/wall/wall-window.js';
import { visibleArtworkNodes } from '../dist/modules/apps/web/src/features/map/map-visibility.js';
import { mapArtworks } from '../src/redesign/map-artworks.mjs';
import { initialAppState, appReducer } from '../dist/modules/apps/web/src/app/app.reducer.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const corpus = JSON.parse(await read('data-packs/met-10k-lean-v2/corpus.json'));
const executable = async source => (await transform(source, { loader: 'jsx', format: 'esm' })).code
  .replace(/^import [\s\S]*? from [^;]+;\n/gm, '').replace(/^export \{[\s\S]*?\};?\s*$/m, '');
const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
const OptimizedArtworkImage = () => ({ type: 'original-proxy' });

// Regression: visible design surfaces must share a browser/CDN cache key.
// The server cache and search contracts are unchanged; no live provider is mocked as verified.
test('one remote artwork uses one original CDN URL across all presentation sizes', async () => {
  let authored, name;
  try { authored = await read('src/redesign/GalleryImage.jsx'); name = 'ArtworkImage'; }
  catch (e) { if (e.code !== 'ENOENT') throw e; authored = await read('dist/modules/apps/web/src/shared/ui/ArtworkImage.js'); name = 'ArtworkImage'; }
  let failed = false;
  const component = new Function('React','useState','OptimizedArtworkImage','mediumSource','imagePriority','imageUrl','imageSrcSet','canResize',
    await executable(authored) + `\nreturn ${name};`)(React, () => [failed, value => { failed = value; }], OptimizedArtworkImage, mediumSource, imagePriority, imageUrl, imageSrcSet, canResize);
  const source = 'https://images.metmuseum.org/CRDImages/ao/web-large/33.149.41.jpg';
  const resolve = props => { let node = component(props); while (typeof node.type === 'function' && node.type !== OptimizedArtworkImage) node = node.type(node.props); return node; };
  for (const sizes of ['48px', '90px', '280px']) {
    const image = resolve({ src: source, sizes, eager: true, priority: true, alt: 'Original artwork', width: 400, height: 500 });
    assert.equal(image.type, 'img');
    assert.equal(image.props.src, source, 'the same artwork must not start 160/320/640px transform jobs');
    assert.equal(image.props.srcSet, undefined);
    assert.equal(image.props.alt, 'Original artwork');
    assert.equal(image.props.fetchPriority, 'high');
  }
  const image = resolve({ src: source, alt: 'Original artwork' });
  image.props.onError();
  assert.equal(resolve({ src: source }).type, OptimizedArtworkImage, 'a failed direct CDN request retains the complete original fallback pipeline');
  failed = false;
  assert.equal(component({ src: '/packs/met-10k-lean-v2/images/552610.jpg' }).type, OptimizedArtworkImage, 'bundled images retain their prepared derivative cache');
});

test('opening a detail reuses its original/web-large gallery URL eagerly and keeps bundled previews', async () => {
  const states = []; let cursor = 0;
  const component = new Function('React','useState','OptimizedArtworkImage','mediumSource','imagePriority','imageUrl',
    await executable(await read('src/redesign/GalleryImage.jsx')) + '\nreturn ArtworkImage;')(
      React, initial => { const index = cursor++; states[index] ??= initial; return [states[index], value => { states[index] = value; }]; },
      OptimizedArtworkImage, mediumSource, imagePriority, imageUrl);
  const artwork = corpus.items.find(item => item.title === 'Feeding Poor Puss');
  const resolve = props => { cursor = 0; let node = component(props); while (typeof node.type === 'function' && node.type !== OptimizedArtworkImage) node = node.type(node.props); return node; };
  const detail = resolve({ src: artwork.detailImageUrl, fallbackSrc: artwork.thumbnailUrl, role: 'detail', alt: artwork.title });
  assert.equal(detail.props.src, artwork.thumbnailUrl, 'opening the screenshot artwork must not enqueue a fresh transform');
  assert.equal(detail.props.loading, 'eager');
  assert.equal(detail.props.fetchPriority, 'high');
  assert.equal(detail.props.srcSet, undefined);
  const bundled = corpus.items.find(item => /^\/packs\//.test(item.thumbnailUrl));
  const preview = resolve({ src: bundled.detailImageUrl, fallbackSrc: bundled.thumbnailUrl, role: 'detail' });
  assert.equal(preview.props.style.backgroundImage, `url("${imageUrl(bundled.thumbnailUrl, 640)}")`);
  preview.props.onLoad();
  assert.equal(resolve({ src: bundled.detailImageUrl, fallbackSrc: bundled.thumbnailUrl, role: 'detail' }).props.style.backgroundImage, undefined);
});

test('production build routes inspector and comparison images through the gallery presentation only', async () => {
  const options = { entryPoints: ['src/redesign/bootstrap.jsx'], bundle: true, write: false, format: 'esm', metafile: true,
    define: { __NEEDLE_SEARCH_WORKER_URL__: '"/assets/search.worker-TI6JI4PU.js"' }, plugins: [redesignImages] };
  const { metafile } = await build(options);
  for (const panel of ['inspector/InspectorPanel', 'compare/ComparePanel']) {
    const input = metafile.inputs[`dist/modules/apps/web/src/features/${panel}.js`];
    assert.ok(input.imports.some(item => item.path === 'src/redesign/GalleryImage.jsx'), panel + ' shares the wall image URL');
  }
  const gallery = metafile.inputs['src/redesign/GalleryImage.jsx'];
  assert.ok(gallery.imports.some(item => item.path.endsWith('/shared/ui/ArtworkImage.js')), 'original fallback loader remains available without a circular alias');
  assert.match(await read('scripts/build-redesign.mjs'), /plugins:\s*\[redesignImages,\s*searchRelevance\]/, 'the production exporter must enable this binding');
});

const fixture = JSON.parse(await read('tests/fixtures/design-preservation.json'));
const initial = appReducer(initialAppState, { type: 'BOOTSTRAP_READY', corpus, history: [], collections: [], branches: [] });
const stateFor = name => ({ ...initial, activeQuery: name, approximate: { hits: fixture.queries.find(q => q.name === name).fast, trace: { visitedIds: [] } } });

for (const name of ['CollectionWall', 'CategoryMap']) {
  test(`${name} keeps hidden image sources stable while instant search changes`, async () => {
    const refs = []; let cursor = 0; let state;
    const component = new Function('React','useEffect','useMemo','useRef','useState','ArtworkImage','Icon','useAppRuntime','useGalleryState',
      'matchesQueryFilters','scopedCorpusItems','visibleHits','wallWindow','visibleArtworkNodes','mapArtworks',
      await executable(await read(`src/redesign/${name}.jsx`)) + `\nreturn ${name};`)(
      React, () => {}, callback => callback(), value => refs[cursor++] ??= { current: value },
      value => [typeof value === 'function' ? value() : value, () => {}], () => {}, () => {}, () => ({}), () => state,
      matchesQueryFilters, scopedCorpusItems, visibleHits, wallWindow, visibleArtworkNodes, mapArtworks);
    const originalWindow = globalThis.window; globalThis.window = { innerWidth: 1440 };
    const render = (next, active) => {
      cursor = 0; state = next;
      const sources = [];
      const visit = node => { if (Array.isArray(node)) node.forEach(visit); else if (node && typeof node === 'object') { if (node.props?.src) sources.push(node.props.src); visit(node.children); } };
      visit(component({ active })); return sources;
    };
    try {
      const visible = render(stateFor('golden'), true);
      assert.ok(visible.length > 0);
      assert.deepEqual(render(stateFor('ruins'), false), visible, 'a hidden view must not enqueue the new query images');
      assert.notDeepEqual(render(stateFor('ruins'), true), visible, 'opening the view shows the current real results');
    } finally { globalThis.window = originalWindow; }
  });
}
