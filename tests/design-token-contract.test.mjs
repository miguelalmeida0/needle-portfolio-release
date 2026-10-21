import test from 'node:test';
import assert from 'node:assert/strict';
import { expandedCascade, rootTokens, resolveTokens } from '../scripts/style-contract.mjs';

test('token cycles fail instead of hiding behind repeated aliases', () => {
  const values = rootTokens(':root { --a: var(--b); --b: var(--a); }');
  assert.throws(() => resolveTokens('var(--a)', values), /Token cycle/);
});

test('parity rejects changed responsive overrides and selector order', async () => {
  const original = ':root{--width:300px}.panel{width:var(--width)}@media(max-width:680px){:root{--width:200px}}';
  assert.notEqual(await expandedCascade(original), await expandedCascade(original.replace('200px', '210px')));
  assert.notEqual(await expandedCascade('.panel{color:red}.panel{color:blue}'), await expandedCascade('.panel{color:blue}.panel{color:red}'));
});

test('parity resolves nested semantic tokens while retaining scoped bindings', async () => {
  const original = ':root{--width:300px}.panel{width:var(--width);color:#123456}@media(max-width:680px){:root{--width:200px}}';
  const tokenized = ':root{--width:300px;--ink:#123456;--text:var(--ink)}.panel{width:var(--width);color:var(--text)}@media(max-width:680px){:root{--width:200px}}';
  assert.equal(await expandedCascade(tokenized), await expandedCascade(original));
  assert.notEqual(await expandedCascade(tokenized.replace('--ink:#123456', '--ink:#654321')), await expandedCascade(original));
});
