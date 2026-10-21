import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const authored = await readFile(new URL('../src/redesign/CollectionWall.jsx', import.meta.url), 'utf8');
const transformed = (await transform(authored, { loader: 'jsx', jsx: 'transform', format: 'esm' })).code;
const source = transformed
  .replace(/^import [\s\S]*? from [^;]+;\n/gm, '')
  .replace(/^export \{[\s\S]*?\};?\s*$/m, '');
const compile = new Function(
  'React', 'useEffect', 'useMemo', 'useRef', 'useState', 'ArtworkImage',
  'useAppRuntime', 'useGalleryState', 'matchesQueryFilters', 'scopedCorpusItems',
  'visibleHits', 'wallWindow', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame',
  source + '\nreturn CollectionWall;'
);

// Run the actual component's observer effect. Rendering and the browser's native
// scroll clamp are outside this harness; retaining geometry prevents that clamp.
function observeWall(element, initialViewport, scrollElement) {
  const effects = [];
  let viewport = initialViewport;
  let updates = 0;
  let refs = 0;
  let resize;
  let disconnected = false;
  let observed;
  class ResizeObserver {
    constructor(callback) { resize = callback; }
    observe(target) { observed = target; }
    disconnect() { disconnected = true; }
  }
  const state = {
    corpus: { source: { packId: 'preserved-pack' } },
    activeQuery: 'golden', activeClusterId: null, queryFilters: [],
    scopedCollectionId: null, savedCollections: [], resultMode: 'fast'
  };
  const component = compile(
    { createElement: (type, props, ...children) => ({ type, props, children }) },
    effect => effects.push(effect), callback => callback(),
    current => ({ current: refs++ === 0 ? element : current }),
    () => [viewport, update => { viewport = update(viewport); updates++; }],
    () => undefined, () => ({}), () => state, () => true, () => [], () => [],
    () => ({ start: 0, end: 0 }), ResizeObserver,
    callback => { callback(); return 0; }, () => {}
  );
  component({ scrollRef: scrollElement ? { current: scrollElement } : undefined });
  const disconnect = effects[0]();
  return {
    resize: () => resize(),
    viewport: () => viewport,
    updates: () => updates,
    observed: () => observed,
    disconnect: () => { disconnect(); return disconnected; }
  };
}

test('hidden wall resizes retain deep-scroll geometry until a valid viewport returns', () => {
  const element = { clientWidth: 1440, clientHeight: 680 };
  const wall = observeWall(element, { width: 900, height: 680, scrollTop: 250000 });
  assert.equal(wall.observed(), element);
  assert.deepEqual(wall.viewport(), { width: 1440, height: 680, scrollTop: 250000 });
  const visibleViewport = wall.viewport();
  const updatesBeforeHiding = wall.updates();

  for (const [width, height] of [[0, 0], [0, 680], [1440, 0], [-1, 680], [1440, -1]]) {
    element.clientWidth = width;
    element.clientHeight = height;
    wall.resize();
    assert.equal(wall.viewport(), visibleViewport, `ignore ${width}x${height}`);
    assert.equal(wall.updates(), updatesBeforeHiding, 'hidden geometry must not enter viewport state');
  }

  element.clientWidth = 390;
  element.clientHeight = 844;
  wall.resize();
  assert.deepEqual(wall.viewport(), { width: 390, height: 844, scrollTop: 250000 });
  assert.equal(wall.updates(), updatesBeforeHiding + 1);
  assert.equal(wall.disconnect(), true, 'observer cleanup remains attached');
});

// Regression: ISSUE-001 — the entire results page must drive virtualized rows.
// Found by /qa on 2026-10-21. Browser replay is recorded in docs/needle-qa-scroll-images.md.
test('page scrolling measures the page viewport and subtracts the results heading', () => {
  const listeners = new Map();
  const element = {
    clientWidth: 1440, clientHeight: 700000,
    getBoundingClientRect: () => ({ top: 220 - page.scrollTop }),
  };
  const page = {
    clientHeight: 600, scrollTop: 500,
    getBoundingClientRect: () => ({ top: 0 }),
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
  };
  const originalFrame = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = callback => { callback(); return 0; };
  globalThis.cancelAnimationFrame = () => {};
  try {
    const wall = observeWall(element, { width: 900, height: 680, scrollTop: 0 }, page);
    assert.deepEqual(wall.viewport(), { width: 1440, height: 600, scrollTop: 280 });
    assert.equal(typeof listeners.get('scroll'), 'function');
    page.scrollTop = 1800;
    listeners.get('scroll')();
    assert.equal(wall.viewport().scrollTop, 1580, 'wheel/page scroll advances the mounted window');
    element.clientWidth = 0;
    wall.resize();
    assert.equal(wall.viewport().scrollTop, 1580, 'a hidden view keeps its scroll window');
    wall.disconnect();
    assert.equal(listeners.has('scroll'), false);
  } finally {
    globalThis.requestAnimationFrame = originalFrame;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});

test('an initially hidden mounted wall keeps its previous geometry', () => {
  const previous = { width: 1024, height: 700, scrollTop: 300000 };
  const element = { clientWidth: 0, clientHeight: 0 };
  const wall = observeWall(element, previous);
  assert.equal(wall.viewport(), previous);
  assert.equal(wall.updates(), 0);
  assert.equal(wall.observed(), element, 'continue observing so showing the wall can resize it');
  assert.equal(wall.disconnect(), true);
});
