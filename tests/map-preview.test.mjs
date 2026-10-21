import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mapArtworks } from '../src/redesign/map-artworks.mjs';
import { initialAppState, appReducer } from '../dist/modules/apps/web/src/app/app.reducer.js';
import { scopedCorpusItems, visibleHits } from '../dist/modules/apps/web/src/app/app.selectors.js';
import { visibleArtworkNodes } from '../dist/modules/apps/web/src/features/map/map-visibility.js';

const corpus = JSON.parse(await readFile(new URL('../data-packs/met-10k-lean-v2/corpus.json', import.meta.url)));
const saved = corpus.items.filter(item => !item.previewRank || item.previewRank > 600).slice(0, 48);
let state = appReducer(initialAppState, { type: 'BOOTSTRAP_READY', corpus, history: [], collections: [{ id: 'qa-light', name: 'Light', artworkIds: saved.map(item => item.id) }], branches: [] });
state = appReducer(state, { type: 'COLLECTION_SCOPE_CHANGED', collectionId: 'qa-light' });
state = appReducer(state, { type: 'TEXT_SEARCH_CLEARED' });

test('cleared search in a saved collection supplies real images to both preview and map', () => {
  assert.deepEqual(visibleHits(state), []);
  const formerMap = visibleArtworkNodes({ items: scopedCorpusItems(state), hits: [], visitedIds: [], selectedId: null, queryId: null, view: 'space', previewLimit: 120 });
  assert.equal(formerMap.length, 0, 'fixture reproduces the old blank-map path');
  const preview = mapArtworks(state, 12).slice(0, 12);
  const map = mapArtworks(state);
  assert.equal(preview.length, 12);
  assert.deepEqual(map.map(item => item.id), saved.map(item => item.id));
  assert.ok(preview.every(item => map.includes(item) && item.thumbnailUrl));
  assert.equal(new Set(map.map(item => item.id)).size, map.length);
});

test('empty saved scopes stay empty and preview work stays bounded for larger collections', () => {
  const empty = { ...state, savedCollections: [{ id: 'qa-light', artworkIds: [] }] };
  assert.deepEqual(mapArtworks(empty), [], 'no unrelated images from the full corpus');
  const larger = { ...state, savedCollections: [{ id: 'qa-light', artworkIds: corpus.items.slice(300, 600).map(item => item.id) }] };
  assert.equal(mapArtworks(larger, 12).slice(0, 12).length, 12);
  assert.ok(mapArtworks(larger, 72).length <= 72);
});
