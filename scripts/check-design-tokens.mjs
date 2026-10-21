import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import { authoringStyles, expandedCascade, rootTokens, resolveTokens } from './style-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const manifest = JSON.parse(await read('docs/design-token-release.json'));
const baseline = await read(manifest.baselineFile);
const deployed = await read(`dist/assets/${manifest.filename}`);
assert.equal(hash(baseline), manifest.baselineCssSha256, 'Frozen production baseline');
assert.equal(hash(deployed), manifest.digest, 'Exact preserved live stylesheet');
assert.equal(manifest.filename, `styles-${manifest.digest.slice(0, 8).toUpperCase()}.css`);
const source = authoringStyles(root);
assert.deepEqual(source.files, manifest.sourceFiles, 'Complete ordered source graph');
const rebuilt = await build({
  absWorkingDir: root, entryPoints: ['dist/styles/index.css'], bundle: true,
  minify: true, write: false, legalComments: 'none', charset: 'utf8', logLevel: 'silent',
});
assert.deepEqual(rebuilt.warnings, []);
assert.equal(rebuilt.outputFiles[0].text, deployed, 'Sources reproduce the live CSS byte for byte');
for (const [label, css] of [['source', source.css], ['bundle', deployed]]) {
  const values = rootTokens(css);
  for (const name of values.keys()) resolveTokens(`var(${name})`, values);
  assert.equal(await expandedCascade(css), await expandedCascade(baseline), `${label}: preserve values, selectors, media conditions and order`);
  const ast = postcss.parse(css);
  const definitions = new Set();
  const references = new Set();
  ast.walkDecls(d => {
    if (d.prop.startsWith('--')) definitions.add(d.prop);
    for (const match of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) references.add(match[1]);
  });
  // These are inherited from the frozen live baseline. ink-900 is existing
  // unresolved visual debt; defining it would change the approved appearance.
  // The other properties are assigned per artwork by the existing runtime.
  const inherited = ['--ink-900', '--node-x', '--node-y', '--node-delay', '--cluster-x', '--cluster-y', '--cluster-color', '--range-progress'];
  const baselineAst = postcss.parse(baseline);
  const baseDefs = new Set();
  const baseRefs = new Set();
  baselineAst.walkDecls(d => {
    if (d.prop.startsWith('--')) baseDefs.add(d.prop);
    for (const match of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) baseRefs.add(match[1]);
  });
  const missing = [...references].filter(n => !definitions.has(n)).sort();
  const baselineMissing = [...baseRefs].filter(n => !baseDefs.has(n)).sort();
  assert.ok(baselineMissing.every(n => inherited.includes(n)), 'Unknown baseline reference');
  assert.deepEqual(missing, baselineMissing, `${label}: no new unresolved static references`);
  assert.equal(values.size - rootTokens(baseline).size, manifest.newTokens, `${label}: token count`);
}
const html = await read('dist/index.html');
const design = JSON.parse(await read('dist/redesign-release.json'));
assert.equal(hash(await read('dist' + design.stylesheet)), design.stylesheetSha256);
assert.equal(hash(await read('dist' + design.bootstrap)), design.bootstrapSha256);
assert.deepEqual([...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]), [`/assets/${manifest.filename}`, design.stylesheet]);
assert.ok(html.includes(design.bootstrap));
assert.equal(hash(await read('dist/assets/bootstrap-9FA4D098.js')), manifest.bootstrapSha256, 'Preserve instant-search runtime');
for (const match of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)) await read('dist' + match[1]);
console.log(`PASS: ${source.files.length} ordered source modules reproduce ${manifest.filename}; SHA-256 ${manifest.digest}`);
console.log(`PASS: ${manifest.newTokens} new tokens; exact production cascade and instant-search bootstrap preserved; no new unresolved static references`);
