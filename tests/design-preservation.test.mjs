import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ArtEmbeddingSpace } from '../dist/modules/packages/query-encoder/src/art-embedding-space.js';
import { HybridSearchEngine } from '../dist/modules/packages/search-runtime/src/hybrid-search-engine.js';
import { toSearchDocument } from '../dist/modules/packages/search-runtime/src/local-search-engine.js';
import { validateCorpus } from '../dist/modules/packages/museum-corpus/src/corpus.repository.js';
import { initialAppState, appReducer } from '../dist/modules/apps/web/src/app/app.reducer.js';
import { matchesQueryFilters, scopedCorpusItems, visibleHits } from '../dist/modules/apps/web/src/app/app.selectors.js';
import { wallWindow } from '../dist/modules/apps/web/src/features/wall/wall-window.js';

const read = path => readFile(new URL('../' + path, import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = JSON.parse(await read('tests/fixtures/design-preservation.json'));
const rawBytes = await read('data-packs/met-10k-lean-v2/corpus.json');
const raw = JSON.parse(rawBytes);
const graph = JSON.parse(await read('dist/data/search-graph.json'));
const space = new ArtEmbeddingSpace();
// Match search.worker's load-corpus preparation, including existing visual descriptors.
const corpus = {
  ...raw,
  dimensions: space.dimensions,
  items: raw.items.map(item => ({
    ...item,
    vector: [...space.encodeArtwork(item,
      item.visualVector?.length === raw.embedding.visualDimensions ? item.visualVector : undefined)]
  }))
};
const engine = new HybridSearchEngine(
  corpus.items.map(item => ({ id: item.id, vector: Float32Array.from(item.vector) })),
  corpus.items.map(toSearchDocument),
  () => undefined,
  graph.snapshot
);
const byId = new Map(corpus.items.map(item => [item.id, item]));

async function filesBelow(path) {
  const entries = await readdir(new URL('../' + path, import.meta.url), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesBelow(path + '/' + entry.name)
    : [path + '/' + entry.name]))).flat().sort();
}

function assertHits(actual, expected, label) {
  assert.deepEqual(actual.map(hit => ({ id: hit.id, rank: hit.rank })),
    expected.map(hit => ({ id: hit.id, rank: hit.rank })), label + ' membership/order');
  actual.forEach((hit, index) => assert.ok(Math.abs(hit.distance - expected[index].distance) <= 1e-12,
    label + ': distance changed for ' + hit.id));
}

function search(query, exact) {
  return engine.search({
    vector: [...space.encodeText(query.text)], queryKind: 'text', queryText: query.text,
    filters: query.filters, k: fixture.k, efSearch: fixture.efSearch, exact
  });
}

const baselineState = appReducer(initialAppState, {
  type: 'BOOTSTRAP_READY', corpus, history: [], collections: [], branches: []
});
const query = name => fixture.queries.find(item => item.name === name);
function wallStates() {
  const golden = query('golden');
  return {
    all: { ...baselineState, approximate: { hits: golden.fast } },
    truth: { ...baselineState, approximate: { hits: golden.fast }, exact: { hits: golden.exact }, resultMode: 'truth' },
    brass: { ...baselineState, queryFilters: [{ field: 'medium', value: ' bRass ' }], approximate: { hits: query('brass-filter').fast } },
    scope: { ...baselineState, savedCollections: [{ id: 'baseline', artworkIds: query('saved-scope').filters.ids }], scopedCollectionId: 'baseline', approximate: { hits: query('saved-scope').fast } },
    cluster: { ...baselineState, activeClusterId: 'animals', approximate: { hits: golden.fast } }
  };
}

// Execute the actual deployed component. Hooks provide one initial render; effects,
// browser geometry and React DOM are deliberately outside this Node characterization.
async function makeWallRenderer() {
  const source = (await read('dist/modules/apps/web/src/features/wall/CollectionWall.js')).toString()
    .replace(/^import .*;\n/gm, '')
    .replace('export function CollectionWall', 'function CollectionWall');
  const compile = new Function('React', 'useEffect', 'useMemo', 'useRef', 'useState',
    'ArtworkImage', 'useAppRuntime', 'useGalleryState', 'matchesQueryFilters', 'scopedCorpusItems',
    'visibleHits', 'wallWindow', source + '\nreturn CollectionWall;');
  return state => {
    const component = compile(
      { createElement: (type, props, ...children) => ({ type, props, children }) },
      () => undefined, fn => fn(), current => ({ current }), initial => [initial, () => undefined],
      () => undefined, () => ({}), () => state,
      matchesQueryFilters, scopedCorpusItems, visibleHits, wallWindow
    );
    const tree = component();
    const mountedIds = [];
    const visit = node => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') {
        if (node.props?.['data-artwork-id']) mountedIds.push(node.props['data-artwork-id']);
        visit(node.children);
      }
    };
    visit(tree);
    return { label: tree.props['aria-label'], mountedIds };
  };
}

test('preservation fixture pins the pre-design corpus, graph, all 120 images and deployed logic bytes', async () => {
  assert.equal(fixture.baselineCommit, 'd61d2ab89ff1771cf5892e93590ee8f64ea71c53');
  assert.equal(sha256(JSON.stringify(fixture.immutable)),
    '0ea7e0db63cc6ae6fa5190b02b0fe51eddfec7c6e46514fcbb643b355bf3ca6b',
    'baseline must not be regenerated to accept a design regression');
  assert.equal(fixture.immutableSetSha256, sha256(JSON.stringify(fixture.immutable)));
  assert.equal(Object.keys(fixture.immutable.core).length, 58);
  const images = await filesBelow('data-packs/met-10k-lean-v2/images');
  assert.equal(images.length, fixture.localImageCount);
  assert.deepEqual(images, Object.keys(fixture.immutable.images));
  for (const [group, records] of Object.entries(fixture.immutable)) {
    for (const [path, expected] of Object.entries(records)) {
      assert.equal(sha256(await read(path)), expected, `${group}: ${path} must remain byte-identical`);
    }
  }
  // Detect new implementation files in core packages, not just changed known files.
  for (const directory of [
    ...['contracts', 'museum-corpus', 'query-encoder', 'search-runtime', 'vector-engine']
      .map(name => 'dist/modules/packages/' + name + '/src'),
    'dist/modules/apps/web/src/shared/utils', 'dist/modules/apps/web/src/shared/images', 'scripts/data-packs'
  ]) {
    const actual = (await filesBelow(directory)).filter(path => /\.(?:js|mjs)$/.test(path));
    const expected = Object.keys(fixture.immutable.core).filter(path => path.startsWith(directory + '/'));
    assert.deepEqual(actual, expected, directory + ' implementation inventory');
  }
  validateCorpus(raw);
  assert.equal(raw.items.length, fixture.recordCount);
  assert.equal(new Set(raw.items.map(item => item.id)).size, fixture.recordCount);
  assert.equal(graph.corpusSha256, sha256(rawBytes));
  assert.equal(graph.encoderVersion, 1);
  assert.equal(baselineState.efSearch, fixture.efSearch);
  assert.equal(baselineState.resultCount, fixture.k);
  // npm's release assembly creates this ignored static fallback. Check it when present.
  const fallback = await read('dist/data/corpus.json').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (fallback) assert.equal(sha256(fallback), sha256(rawBytes), 'static fallback is the same full corpus');
});

for (const entry of fixture.queries) {
  for (const exact of [false, true]) {
    const mode = exact ? 'exact' : 'fast';
    test(`deployed ${mode} search preserves ${entry.name} ranking and distances`, () => {
      const result = search(entry, exact);
      assertHits(result.hits, entry[mode], `${entry.name}/${mode}`);
      assert.ok(result.hits.every(hit => byId.has(hit.id)), 'all hits come from the real collection');
      if (entry.filters?.ids) assert.ok(result.hits.every(hit => entry.filters.ids.includes(hit.id)));
      if (entry.name === 'brass-filter') assert.ok(result.hits.every(hit => matchesQueryFilters(byId.get(hit.id), [{ field: 'medium', value: ' bRass ' }])));
      if (entry.name === 'compound-filter') assert.ok(result.hits.every(hit => matchesQueryFilters(byId.get(hit.id), [
        { field: 'cluster', value: 'objects' }, { field: 'culture', value: 'Akan' }, { field: 'before', value: 1800 }
      ])));
      if (exact) assert.equal(result.inspectedRatio, 1);
    });
  }
}

test('real wall preserves full collection membership, ranking, truth mode, filters and saved scope ordering', async () => {
  const render = await makeWallRenderer();
  const originalOrder = corpus.items.map(item => item.id);
  for (const [name, state] of Object.entries(wallStates())) {
    const expected = fixture.walls[name];
    assert.deepEqual(render(state), { label: expected.label, mountedIds: expected.mountedIds }, name);
    if (expected.scopedIds) assert.deepEqual(scopedCorpusItems(state).map(item => item.id), expected.scopedIds,
      'saved scope preserves corpus order and ignores nonexistent IDs');
  }
  assert.deepEqual(corpus.items.map(item => item.id), originalOrder, 'wall never mutates corpus order');
  assert.equal(scopedCorpusItems(baselineState).length, 10000);
  assert.deepEqual(visibleHits(wallStates().truth), query('golden').exact);
});

test('existing filter boundaries and virtualized final rows remain reachable', () => {
  const censer = byId.get('met-470767'); // year 1500
  assert.equal(matchesQueryFilters(censer, [{ field: 'before', value: 1500 }]), false);
  assert.equal(matchesQueryFilters(censer, [{ field: 'after', value: 1500 }]), false);
  assert.equal(matchesQueryFilters(censer, [{ field: 'before', value: 1501 }, { field: 'after', value: 1499 }]), true);
  assert.equal(matchesQueryFilters({ ...censer, year: null }, [{ field: 'before', value: 1800 }]), false);
  for (const columns of [2, 3, 4, 5]) {
    const rowHeight = 200;
    const height = 680;
    const first = wallWindow(10000, columns, rowHeight, height, 0);
    const last = wallWindow(10000, columns, rowHeight, height, Math.ceil(10000 / columns) * rowHeight - height);
    assert.equal(first.start, 0);
    assert.equal(last.end, 10000, `last artwork reachable with ${columns} columns`);
    assert.ok(first.end - first.start < 40 && last.end - last.start < 40, 'bounded mounted window');
  }
});
