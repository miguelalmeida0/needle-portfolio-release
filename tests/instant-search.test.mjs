import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AppRuntime } from '../dist/modules/apps/web/src/app/app.runtime.js';
import { SearchService } from '../dist/modules/packages/search-runtime/src/search.service.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const result = id => ({ hits: [{ id, score: 0.9 }], latencyMs: 1, mode: 'fast' });
function makeRuntime() {
  const runtime = new AppRuntime();
  runtime.store.dispatch({
    type: 'BOOTSTRAP_READY',
    corpus: {
      items: [{ id: 'first' }, { id: 'second' }],
      defaultQuery: { text: 'door', exemplarArtworkId: 'first' }
    },
    history: [],
    collections: [],
    branches: []
  });
  return runtime;
}

test('typing previews results without polluting history; explicit search records history', async t => {
  const original = SearchService.prototype.search;
  const requests = [];
  SearchService.prototype.search = async request => {
    requests.push(request);
    return result('first');
  };
  t.after(() => { SearchService.prototype.search = original; });

  const runtime = makeRuntime();
  t.after(() => runtime.dispose());
  runtime.setDraft('do');
  await runtime.submitDraft(false);
  assert.equal(runtime.store.getSnapshot().activeQuery, 'do');
  assert.equal(runtime.store.getSnapshot().approximate.hits[0].id, 'first');
  assert.equal(runtime.store.getSnapshot().history.length, 0, 'typing should not add recent-query history');
  assert.equal(requests[0].queryText, 'do');

  runtime.setDraft('door');
  await runtime.submitDraft(false);
  assert.equal(runtime.store.getSnapshot().activeQuery, 'door');
  assert.equal(runtime.store.getSnapshot().history.length, 0);
  await runtime.submitDraft();
  assert.equal(runtime.store.getSnapshot().history[0].text, 'door', 'explicit search should record history');
});

test('superseded worker responses stay discarded even during unfinished input composition', async t => {
  const original = SearchService.prototype.search;
  const pending = new Map();
  SearchService.prototype.search = request => new Promise(resolve => pending.set(request.queryText, resolve));
  t.after(() => { SearchService.prototype.search = original; });

  const runtime = makeRuntime();
  t.after(() => runtime.dispose());
  runtime.setDraft('door');
  const first = runtime.submitDraft(false);
  assert.ok(pending.has('door'));
  runtime.setDraft('do');
  pending.get('door')(result('first'));
  await first;
  assert.equal(runtime.store.getSnapshot().approximate, null, 'old response ignored');

  const second = runtime.submitDraft(false);
  assert.ok(pending.has('do'));
  pending.get('do')(result('second'));
  await second;
  assert.equal(runtime.store.getSnapshot().activeQuery, 'do');
  assert.equal(runtime.store.getSnapshot().approximate.hits[0].id, 'second');
  assert.equal(runtime.store.getSnapshot().history.length, 0);
});

test('deployed immutable bootstrap agrees with the source contract', async () => {
  const html = await read('dist/index.html');
  const match = html.match(/<script type="module" src="(\/assets\/bootstrap-[A-Z0-9]{8}\.js)"/);
  assert.ok(match, 'active script is versioned');
  const jsPath = 'dist' + match[1];
  const js = await read(jsPath);
  const composer = await read('dist/modules/apps/web/src/features/search/SearchComposer.js');
  const runtime = await read('dist/modules/apps/web/src/app/app.runtime.js');

  assert.match(composer, /void runtime\.submitDraft\(false\)/);
  assert.doesNotMatch(composer, /debounce\.current|setTimeout\(/);
  assert.match(runtime, /async submitDraft\(addToHistory = true\)/);
  assert.match(runtime, /this\.\#activeSearchSequence\+\+;\s*this\.store\.dispatch\(\{ type: 'DRAFT_CHANGED'/);
  assert.match(js, /async submitDraft\([\w$]+=!0\)/);
  assert.match(js, /[\w$]+\.current\|\|[\w$]+\.submitDraft\(!1\)/);
  assert.doesNotMatch(js, /n\.current=setTimeout\(\(\)=>\{n\.current=null,s\.submitDraft\(\)\},350\)/);
  const parsed = spawnSync(process.execPath, ['--check', fileURLToPath(new URL('../' + jsPath, import.meta.url))], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr || parsed.stdout);
});
