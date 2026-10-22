import test from 'node:test';
import assert from 'node:assert/strict';
import { mapArtworks } from '../src/redesign/map-artworks.mjs';
import { textResult } from '../src/search/result-state.mjs';
import { initialAppState, appReducer } from '../dist/modules/apps/web/src/app/app.reducer.js';
import { readFile } from 'node:fs/promises';
const corpus = JSON.parse(await readFile(new URL('../data-packs/met-10k-lean-v2/corpus.json', import.meta.url)));
const base = appReducer(initialAppState, { type: 'BOOTSTRAP_READY', corpus, history: [], collections: [], branches: [] });
const response = { hits: [], relevance: { version: 'catalogue-v2', matchedCount: 0, status: 'no-match' }, trace: { visitedIds: [] } };
test('no-match text search never fills its map preview with the rest of the collection', () => {
  const state = { ...base, activeQuery: 'cars', approximate: response };
  assert.equal(textResult(state), response);
  assert.deepEqual(mapArtworks(state, 12), []);
});
test('clearing search restores the original collection browsing path', () => {
  const state = { ...base, activeQuery: '', approximate: response };
  assert.equal(textResult(state), null);
  assert.ok(mapArtworks(state, 12).length > 0);
});
