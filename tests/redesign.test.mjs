import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { createNavigation } from '../src/redesign/navigation.mjs';
import { initialAppState, appReducer } from '../dist/modules/apps/web/src/app/app.reducer.js';
import { matchesQueryFilters, scopedCorpusItems, visibleHits } from '../dist/modules/apps/web/src/app/app.selectors.js';
import { wallWindow } from '../dist/modules/apps/web/src/features/wall/wall-window.js';
import { visibleArtworkNodes } from '../dist/modules/apps/web/src/features/map/map-visibility.js';
import { mapArtworks } from '../src/redesign/map-artworks.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const fixture = JSON.parse(await read('tests/fixtures/design-preservation.json'));
const corpus = JSON.parse(await read('data-packs/met-10k-lean-v2/corpus.json'));
const baseline = appReducer(initialAppState, { type: 'BOOTSTRAP_READY', corpus, history: [], collections: [], branches: [] });
const query = name => fixture.queries.find(entry => entry.name === name);
const golden = query('golden');
const states = {
  all: { ...baseline, approximate: { hits: golden.fast } },
  truth: { ...baseline, approximate: { hits: golden.fast }, exact: { hits: golden.exact }, resultMode: 'truth' },
  brass: { ...baseline, queryFilters: [{ field: 'medium', value: ' bRass ' }], approximate: { hits: query('brass-filter').fast } },
  scope: { ...baseline, savedCollections: [{ id: 'baseline', artworkIds: query('saved-scope').filters.ids }], scopedCollectionId: 'baseline', approximate: { hits: query('saved-scope').fast } },
  cluster: { ...baseline, activeClusterId: 'animals', approximate: { hits: golden.fast } }
};

// Execute the authored JSX and deployed wall with identical production selectors.
// Geometry is supplied through the viewport hook; DOM effects belong to browser QA.
async function renderer(path, jsx = false) {
  let source = await read(path);
  if (jsx) source = (await transform(source, { loader: 'jsx', jsx: 'transform', format: 'esm' })).code;
  source = source.replace(/^import [\s\S]*? from [^;]+;\n/gm, '').replace(/^export \{[\s\S]*?\};?\s*$/m, '').replace('export function CollectionWall', 'function CollectionWall');
  const compile = new Function('React', 'useEffect', 'useMemo', 'useRef', 'useState', 'ArtworkImage', 'useAppRuntime', 'useGalleryState', 'matchesQueryFilters', 'scopedCorpusItems', 'visibleHits', 'wallWindow', source + '\nreturn CollectionWall;');
  return (state, viewport, calls = []) => {
    const ArtworkImage = () => undefined;
    const component = compile(
      { createElement: (type, props, ...children) => ({ type, props, children }) },
      () => undefined, callback => callback(), current => ({ current }), initial => [initial?.width ? viewport : initial, () => undefined],
      ArtworkImage, () => ({ selectArtwork: id => calls.push(['select', id]) }), () => state,
      matchesQueryFilters, scopedCorpusItems, visibleHits, wallWindow
    );
    const tree = component({ onOpen: id => calls.push(['open', id]) });
    const cards = [];
    const visit = node => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') {
        if (node.props?.['data-artwork-id']) cards.push(node);
        visit(node.children);
      }
    };
    visit(tree);
    return { tree, cards, ArtworkImage };
  };
}

const renderLegacy = await renderer('dist/modules/apps/web/src/features/wall/CollectionWall.js');
const renderDesign = await renderer('src/redesign/CollectionWall.jsx', true);

for (const [name, state] of Object.entries(states)) {
  test(`redesigned wall preserves ${name} membership, ranking and all responsive windows`, () => {
    const legacy = renderLegacy(state, { width: 900, height: 1e7, scrollTop: 0 });
    const orderedIds = legacy.cards.map(card => card.props['data-artwork-id']);
    assert.deepEqual(orderedIds.slice(0, fixture.walls[name].mountedIds.length), fixture.walls[name].mountedIds);
    for (const [width, columns] of [[390, 2], [768, 3], [1024, 4], [1440, 5]]) {
      const gap = width < 620 ? 10 : 18;
      const rowHeight = (width - gap * (columns - 1)) / columns * 1.25 + gap;
      for (const scrollTop of [0, Math.max(0, (Math.ceil(orderedIds.length / columns) - 2) * rowHeight)]) {
        const { tree, cards } = renderDesign(state, { width, height: 680, scrollTop });
        assert.equal(tree.props['aria-label'], fixture.walls[name].label);
        const window = wallWindow(orderedIds.length, columns, rowHeight, 680, scrollTop);
        assert.deepEqual(cards.map(card => card.props['data-artwork-id']), orderedIds.slice(window.start, window.end));
        if (cards.length) {
          const imageWidth = (width - gap * (columns - 1)) / columns;
          assert.equal(cards[0].props.style.width, `${imageWidth}px`);
          assert.equal(cards[0].props.style.height, `${imageWidth * 1.25}px`);
        }
        assert.ok(cards.length <= columns * (Math.ceil(680 / rowHeight) + 3), 'mounted nodes stay bounded');
        if (scrollTop) assert.equal(cards.at(-1).props['data-artwork-id'], orderedIds.at(-1), 'final artwork remains reachable');
      }
    }
  });
}

test('image buttons retain the original artwork sources and select before opening details', () => {
  const calls = [];
  const { cards, ArtworkImage } = renderDesign(states.all, { width: 1440, height: 680, scrollTop: 0 }, calls);
  const first = cards[0], id = first.props['data-artwork-id'];
  const artwork = corpus.items.find(item => item.id === id);
  assert.equal(first.props['data-index'], 0);
  assert.ok(first.props['aria-label'].includes(artwork.title));
  assert.equal(first.children.length, 1, 'wall image has no caption/rank/chrome siblings');
  const image = first.children[0];
  assert.equal(image.type, ArtworkImage);
  assert.equal(image.props.src, artwork.thumbnailUrl ?? artwork.imageUrl);
  assert.equal(image.props.width, artwork.imageWidth);
  assert.equal(image.props.height, artwork.imageHeight);
  assert.equal(image.props.dominantColor, artwork.dominantColor);
  first.props.onClick();
  assert.deepEqual(calls, [['select', id], ['open', id]]);
});

test('wall keyboard traversal follows the responsive columns and leaves collection boundaries alone', () => {
  const originalFrame = globalThis.requestAnimationFrame;
  try {
    globalThis.requestAnimationFrame = callback => { callback(); return 0; };
    for (const [width, columns] of [[390, 2], [768, 3], [1024, 4], [1440, 5]]) {
      const { tree } = renderDesign(states.all, { width, height: 680, scrollTop: 0 });
      const focused = [];
      tree.props.ref.current = { scrollTop: 0, querySelector: selector => ({ focus: options => focused.push([selector, options]) }) };
      let prevented = false;
      tree.props.onKeyDown({ key: 'ArrowDown', target: { closest: () => ({ dataset: { index: '0' } }) }, preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true);
      assert.deepEqual(focused, [[`[data-index="${columns}"]`, { preventScroll: true }]]);
      tree.props.onKeyDown({ key: 'ArrowLeft', target: { closest: () => ({ dataset: { index: '0' } }) }, preventDefault: () => assert.fail('boundary must retain browser behavior') });
      assert.equal(focused.length, 1);
    }
  } finally {
    if (originalFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = originalFrame;
  }
});

test('category map keeps every real match, unrelated context and saved-scope isolation', async () => {
  const source = (await transform(await read('src/redesign/CategoryMap.jsx'), { loader: 'jsx', jsx: 'transform', format: 'esm' })).code
    .replace(/^import [\s\S]*? from [^;]+;\n/gm, '').replace(/^export \{[\s\S]*?\};?\s*$/m, '');
  const compile = new Function('React', 'useEffect', 'useMemo', 'useRef', 'useState', 'ArtworkImage', 'Icon', 'useAppRuntime', 'useGalleryState',
    'matchesQueryFilters', 'scopedCorpusItems', 'visibleHits', 'visibleArtworkNodes', 'mapArtworks', source + '\nreturn CategoryMap;');
  const originalWindow = globalThis.window;
  try {
    for (const width of [390, 1440]) {
      for (const state of [states.all, states.scope, { ...states.all, corpus: { ...corpus, clusters: [...corpus.clusters].reverse() } }]) {
        globalThis.window = { innerWidth: width };
        const calls = [];
        const mapState = { ...state, approximate: { ...state.approximate, trace: { visitedIds: [] } } };
        const component = compile(
          { createElement: (type, props, ...children) => ({ type, props, children }) },
          () => undefined, callback => callback(), current => ({ current }), initial => [typeof initial === 'function' ? initial() : initial, () => undefined],
          () => undefined, () => undefined,
          () => ({ selectArtwork: id => calls.push(['select', id]), setClusterFilter: id => calls.push(['cluster', id]) }), () => mapState,
          matchesQueryFilters, scopedCorpusItems, visibleHits, visibleArtworkNodes, mapArtworks
        );
        const tree = component({ onOpen: id => calls.push(['open', id]) });
        const artworks = [], categories = [];
        const visit = node => {
          if (Array.isArray(node)) node.forEach(visit);
          else if (node && typeof node === 'object') {
            if (node.props?.['data-artwork-id']) artworks.push(node);
            if (node.type === 'h2') categories.push(node);
            assert.notEqual(node.type, 'canvas', 'default map has no ambient point renderer');
            visit(node.children);
          }
        };
        visit(tree);
        const ids = artworks.map(node => node.props['data-artwork-id']);
        const scopedIds = new Set(scopedCorpusItems(state).map(artwork => artwork.id));
        assert.equal(new Set(ids).size, ids.length, 'each real artwork appears once');
        assert.ok(ids.every(id => scopedIds.has(id)), 'no fabricated or out-of-scope image');
        assert.ok(visibleHits(state).every(hit => ids.includes(hit.id)), 'all fast matches remain on the map');
        assert.equal(ids[0], visibleHits(state)[0].id, 'the best match category comes first regardless of catalogue category order');
        if (state.scopedCollectionId) assert.equal(ids.length, scopedIds.size);
        else {
          assert.equal(categories.length, 12);
          assert.ok(ids.length > golden.fast.length, 'unrelated contextual artworks remain visible');
          assert.equal(artworks.filter(node => node.props.className.includes('is-match')).length, golden.fast.length);
        }
        const first = artworks[0];
        first.props.onClick();
        assert.deepEqual(calls, [['select', ids[0]], ['open', ids[0]]]);
        const categoryButton = categories[0].children[0];
        categoryButton.props.onClick();
        assert.equal(calls.at(-1)[0], 'cluster', 'category label retains production filter command');
      }
    }
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

function browserHistory() {
  const entries = [{ state: { unrelated: 'preserved' } }];
  let index = 0;
  return {
    get state() { return entries[index].state; },
    get count() { return entries.length; },
    replaceState(state, _title, url) { entries[index] = { state, url }; },
    pushState(state, _title, url) { entries.splice(index + 1); entries.push({ state, url }); index++; },
    back() { index = Math.max(0, index - 1); },
    forward() { index = Math.min(entries.length - 1, index + 1); }
  };
}

test('presentation history supports contextual Back, Forward and modal dismissal without touching search', () => {
  const history = browserHistory();
  const location = { pathname: '/needle', search: '?mode=art' };
  const nav = createNavigation(history, location);
  assert.deepEqual(nav.current(), { view: 'home', overlay: null, depth: 0 });
  assert.equal(history.state.unrelated, 'preserved');
  nav.visit({ view: 'results' });
  nav.visit({ view: 'map' });
  nav.visit({ overlay: 'artwork' });
  nav.back(); nav.restore(history.state);
  assert.equal(nav.current().view, 'map');
  assert.equal(nav.current().overlay, null);
  nav.back(); nav.restore(history.state);
  assert.equal(nav.current().view, 'results');
  history.forward(); nav.restore(history.state);
  assert.equal(nav.current().view, 'map');
  const count = history.count;
  nav.visit({ view: 'map' });
  assert.equal(history.count, count, 'reselecting a view adds no history entry');
  nav.visit({ view: 'home' });
  nav.visit({ view: 'results' });
  assert.equal(nav.current().view, 'results', 'logo can resume the current runtime results');
  assert.deepEqual(Object.keys(nav.current()).sort(), ['backView', 'depth', 'overlay', 'view'], 'history owns presentation only');
});

test('reloaded presentation route and overlay restore, and first-entry Back stays inside Needle', () => {
  const history = browserHistory();
  const location = { pathname: '/', search: '' };
  let nav = createNavigation(history, location);
  assert.equal(nav.back().view, 'home');
  nav.visit({ view: 'results' }); nav.visit({ overlay: 'saved' });
  nav = createNavigation(history, location);
  assert.deepEqual(nav.current(), { view: 'results', overlay: 'saved', depth: 2, backView: 'results' });
  nav.back(); nav.restore(history.state);
  assert.equal(nav.current().overlay, null);
});
