import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = async (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
function luminance(hex) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function ratio(a, b) {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + .05) / (dark + .05);
}
test('active immutable CSS passes 4.5:1 for catalog text tokens', async () => {
  const html = await text('dist/index.html');
  const match = html.match(/href="(\/assets\/styles-[A-Z0-9]{8}\.css)"/);
  assert.ok(match, 'production uses a versioned stylesheet');
  const css = await text('dist' + match[1]);
  for (const [variable, background] of [
    ['ink-500', '#f8f7f2'],
    ['ink-350', '#f8f7f2'],
    ['negative', '#fff7f5'],
  ]) {
    const token = css.match(new RegExp('--' + variable + ':\\s*(#[a-fA-F0-9]{6})'));
    assert.ok(token, 'defined --' + variable);
    assert.ok(ratio(token[1], background) >= 4.5, variable + ': ' + ratio(token[1], background));
  }
  assert.match(css, /\.query-term__remove \{ width: 28px; height: 28px; opacity: 1;/);
  assert.match(css, /\.inspector-action-list button \{ min-height: 36px; \}/);
  assert.match(css, /\.query-term__copy small,/);
});
test('unbundled source keeps accessibility styles in sync', async () => {
  const tokens = await text('dist/styles/tokens.css');
  const index = await text('dist/styles/index.css');
  const overrides = await text('dist/styles/accessibility.css');
  assert.match(tokens, /--ink-500: #66706a;/);
  assert.match(tokens, /--ink-350: #59615d;/);
  assert.match(tokens, /--negative: #a1493d;/);
  assert.match(index, /@import url\('\.\/accessibility\.css'\)/);
  assert.match(overrides, /\.query-term__remove \{ width: 28px; height: 28px; opacity: 1; \}/);
});
