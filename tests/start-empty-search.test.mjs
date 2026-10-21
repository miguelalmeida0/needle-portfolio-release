import test from 'node:test';
import assert from 'node:assert/strict';
import { AppRuntime } from '../dist/modules/apps/web/src/app/app.runtime.js';
import { startEmptySearch } from '../src/redesign/start-empty-search.mjs';

function setup() {
  const runtime = new AppRuntime();
  let finish;
  runtime.start = async () => {
    runtime.store.dispatch({ type: 'BOOTSTRAP_READY', corpus: { items: [], defaultQuery: { text: 'a dramatic landscape under a restless sky' } }, history: [], collections: [], branches: [] });
    await new Promise(resolve => { finish = resolve; });
  };
  runtime.submitDraft = () => { throw new Error('opening draft must not resubmit or clear the search'); };
  return { runtime, root: new EventTarget(), finish: () => finish() };
}

test('opening startup leaves the placeholder empty without altering the engine query or other routes', async () => {
  for (const hash of ['', '#home', '#results', '#map']) {
    const { runtime, root, finish } = setup();
    try {
      const pending = startEmptySearch(runtime, root, { hash }); finish(); await pending;
      const state = runtime.store.getSnapshot();
      assert.equal(state.draftQuery, !hash || hash === '#home' ? '' : state.corpus.defaultQuery.text);
      assert.equal(state.activeQuery, state.corpus.defaultQuery.text, 'only the editable presentation draft changes');
    } finally { runtime.dispose(); }
  }
});

test('typing and IME during startup retain the user draft, even if it equals the engine demo', async () => {
  for (const event of ['input', 'compositionstart']) {
    const { runtime, root, finish } = setup();
    try {
      const pending = startEmptySearch(runtime, root, { hash: '' });
      root.dispatchEvent(new Event(event));
      const value = event === 'input' ? 'my own idea' : runtime.store.getSnapshot().corpus.defaultQuery.text;
      runtime.setDraft(value); finish(); await pending;
      assert.equal(runtime.store.getSnapshot().draftQuery, value);
    } finally { runtime.dispose(); }
  }
});
