import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ArtEmbeddingSpace } from '../dist/modules/packages/query-encoder/src/art-embedding-space.js';
import { HybridSearchEngine } from '../src/search/hybrid-search-engine.mjs';
import { toSearchDocument } from '../dist/modules/packages/search-runtime/src/local-search-engine.js';

// Real-corpus regression: unsupported subjects must not be filled with unrelated
// nearest neighbours. Existing preservation tests characterize the old engine;
// they never asserted relevance for absent subjects or substring collisions.
const corpus = JSON.parse(await readFile(new URL('../data-packs/met-10k-lean-v2/corpus.json', import.meta.url)));
const graph = JSON.parse(await readFile(new URL('../dist/data/search-graph.json', import.meta.url)));
const space = new ArtEmbeddingSpace();
const items = corpus.items.map(item => ({ ...item, vector: [...space.encodeArtwork(item)] }));
const engine = new HybridSearchEngine(items.map(i => ({ id: i.id, vector: Float32Array.from(i.vector) })), items.map(toSearchDocument), () => {}, graph.snapshot);
const search = (text, exact = false, filters, k = 8) => engine.search({ queryKind: 'text', queryText: text, vector: [...space.encodeText(text)], k, efSearch: 64, exact, filters });
for (const text of ['cars', 'car', 'red cars', 'automobiles', 'smartphones', 'qzvxfoobar']) {
  test(`absent subject “${text}” returns no invented matches in fast and exact modes`, () => {
    assert.deepEqual(search(text).hits, []);
    assert.deepEqual(search(text, true).hits, []);
  });
}
for (const [text, ids] of [['cats', ['met-436433', 'met-53653']], ['doors', ['met-471169', 'met-445997']]]) {
  test(`supported subject “${text}” retains real catalogue matches`, () => {
    const hits = search(text, false, undefined, 50).hits;
    assert.ok(hits.length > 0);
    for (const id of ids) assert.ok(hits.some(hit => hit.id === id), id);
  });
}

test('a real creator name remains searchable as whole words', () => {
  assert.ok(search('Emma Carson').hits.some(hit => hit.id === 'met-647622'));
});
test('an absent object is not rescued by an unrelated color word', () => {
  assert.deepEqual(search('blue smartphones').hits, []);
});
test('all returned hits honor a saved scope and catalog filters', () => {
  assert.deepEqual(search('cats', false, { ids: ['met-471169'] }).hits, []);
  const hits = search('doors', false, { ids: ['met-471169', 'met-445997'] }).hits;
  assert.ok(hits.length > 0);
  assert.ok(hits.every(hit => ['met-471169', 'met-445997'].includes(hit.id)));
});

// Independently labelled examples cover object/color intersections, whole words,
// exclusions, alternatives, plurals, phrases and Unicode, without provider mocks.
const examples = [
  ['red-car', 'Red automobile', ['car', 'red']],
  ['blue-car', 'Blue car', ['car', 'blue']],
  ['carson', 'Emma Carson', ['portrait']],
  ['carpet', 'Red carpet', ['textile', 'red']],
  ['cat', 'Cat at a window', ['cat', 'window']],
  ['cat-dog', 'Cat and dog', ['cat', 'dog']],
  ['door', 'Door', ['door']],
  ['doorknob', 'Doorknob', ['hardware']],
  ['rose', 'Roses by Édouard', ['rose', 'flower']],
].map(([id, title, tags], index) => ({ id, title, tags, creator: title === 'Emma Carson' ? 'A. Photographer' : 'Édouard', medium: 'Oil', classification: 'Paintings', objectName: '', department: '', culture: 'French', period: '', objectDate: '', clusterId: 'test', year: 1900 + index }));
const exampleEngine = new HybridSearchEngine(examples.map(item => ({ id: item.id, vector: space.encodeArtwork(item) })), examples);
const exampleSearch = (queryText, exact = false, filters) => exampleEngine.search({ queryKind: 'text', queryText, vector: [...space.encodeText(queryText)], k: 50, efSearch: 64, exact, filters });
for (const [text, ids] of [
  ['cars', ['red-car', 'blue-car']], ['red cars', ['red-car']],
  ['cats without dogs', ['cat']], ['cats not dogs', ['cat']],
  ['cats or dogs', ['cat', 'cat-dog']], ['doors', ['door']],
  ['"Cat at a window"', ['cat']], ['roses Edouard', ['rose']],
  ['Emma Carson', ['carson']], ['carpets', ['carpet']],
  ['red cars with a window', []], ['"red car"', []],
]) {
  test(`catalogue constraints: ${text}`, () => {
    for (const exact of [false, true]) assert.deepEqual(exampleSearch(text, exact).hits.map(hit => hit.id).sort(), [...ids].sort());
  });
}
test('date and field filters apply before ranking', () => {
  assert.deepEqual(exampleSearch('cars', false, { yearBefore: 1901 }).hits.map(hit => hit.id), ['red-car']);
  assert.deepEqual(exampleSearch('cars', false, { cultures: ['Japanese'] }).hits, []);
});
test('image and mixed requests retain the original retrieval path', async () => {
  const { HybridSearchEngine: Legacy } = await import('../dist/modules/packages/search-runtime/src/hybrid-search-engine.js');
  const entries = examples.map(item => ({ id: item.id, vector: space.encodeArtwork(item) }));
  const legacy = new Legacy(entries, examples);
  for (const queryKind of ['image', 'artwork', 'mixed']) {
    const request = { queryKind, queryText: 'cars', vector: [...entries[0].vector], k: 4, efSearch: 64, exact: false };
    assert.deepEqual(exampleEngine.search(request).hits, legacy.search(request).hits);
  }
});

test('coordinated exclusions never turn excluded subjects into alternatives', async () => {
  const { RelevanceIndex } = await import('../src/search/relevance-index.mjs');
  const index = new RelevanceIndex([{id:'cat', title:'Cat', tags:['cat']}, {id:'cat-bird', title:'Cat with bird', tags:['cat','bird']}, {id:'cat-dog', title:'Cat with dog', tags:['cat','dog']}, {id:'bird', title:'Bird', tags:['bird']}]);
  for (const queryText of ['cats without dogs or birds', 'cats without dogs and birds']) {
    const matches = index.search(queryText).candidates.map(hit=>hit.id);
    assert.deepEqual(matches, ['cat']);
  }
});
test('blank catalogue filter values do not silently match every record', () => {
  assert.deepEqual(exampleSearch('cars', false, { cultures: [' '] }).hits, []);
});

test('short subject titles outrank incidental words in long catalogue titles', () => {
  const titles = new Map(items.map(item=>[item.id,item.title]));
  assert.ok(search('doors').hits.slice(0,3).every(hit => !titles.get(hit.id).includes('door-eengevlochte')));
  assert.ok(search('gold').hits.every(hit => !titles.get(hit.id).includes('Gold Coin series')));
});
