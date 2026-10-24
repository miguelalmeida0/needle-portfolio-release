import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleComparison, comparisonCopy, comparisonTitle, safeCompareIds } from '../src/redesign/comparison.mjs';

test('selecting two distinct artworks opens a pair; tapping selected removes only that item', () => {
  assert.deepEqual(toggleComparison([], 'met-1'), ['met-1']);
  assert.deepEqual(toggleComparison(['met-1'], 'met-2'), ['met-1', 'met-2']);
  assert.deepEqual(toggleComparison(['met-1'], 'met-1'), []);
  assert.deepEqual(toggleComparison(['met-1', 'met-2'], 'met-2'), ['met-1']);
  assert.deepEqual(toggleComparison(['met-1', 'met-2'], 'met-3'), ['met-2', 'met-3']);
});
test('comparison ids reject malformed and duplicate ids and cannot grow beyond two', () => {
  assert.deepEqual(safeCompareIds(['met-1','met-1',null,42,'met-2','met-3']), ['met-1','met-2']);
  assert.deepEqual(safeCompareIds('met-1'), []);
});
test('shared evidence cites actual common catalogue tags and real materials', () => {
  const copy = comparisonCopy({tags:['Dogs','Animals'],medium:'Porcelain'}, {tags:['Animals','dogs'],medium:'Glazed earthenware'});
  assert.match(copy,/dogs/i); assert.match(copy,/porcelain/i); assert.match(copy,/glazed earthenware/i);
  assert.doesNotMatch(copy,/92%|same artist|centur/i);
});
test('no shared tag never invents an art-historical relationship', () => {
  const copy = comparisonCopy({tags:['Ceramics'],medium:'Clay'},{tags:['Portrait'],medium:'Oil on canvas'});
  assert.match(copy,/selected/i); assert.doesNotMatch(copy,/similar|influenc|shared/i);
});
test('comparison title uses the current query without treating markup as content', () => {
  assert.equal(comparisonTitle('dogs'), 'Two ways to see dogs.');
  assert.equal(comparisonTitle('<dogs>'), 'Two works, side by side.');
  assert.equal(comparisonTitle(''), 'Two works, side by side.');
});
