import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Collection wall is the phone default; the desktop default stays spatial', async () => {
  const originalWindow = globalThis.window;
  const reducerURL = new URL('../dist/modules/apps/web/src/app/app.reducer.js', import.meta.url);
  try {
    for (const [width, expectedView] of [[390, 'wall'], [680, 'wall'], [681, 'space'], [1440, 'space']]) {
      globalThis.window = {
        matchMedia(query) {
          assert.equal(query, '(max-width: 680px)');
          return { matches: width <= 680 };
        }
      };
      const { initialAppState, appReducer } = await import(reducerURL.href + '?width=' + width);
      assert.equal(initialAppState.mapView, expectedView, 'default at ' + width + 'px');
      assert.equal(appReducer(initialAppState, { type: 'MAP_VIEW_CHANGED', view: 'focus' }).mapView, 'focus');
      assert.equal(appReducer(initialAppState, { type: 'MAP_VIEW_CHANGED', view: 'wall' }).mapView, 'wall');
    }
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('served bootstrap and stylesheet ship the mobile defaults without disabling zoom', async () => {
  const html = await fs.readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="module" src="(\/assets\/bootstrap-[A-Z0-9]+\.js)"/);
  const style = html.match(/<link rel="stylesheet" href="(\/assets\/styles-[A-Z0-9]+\.css)"/);
  assert.ok(script, 'production bootstrap is linked');
  assert.ok(style, 'production CSS is linked');

  const js = await fs.readFile(new URL('../dist' + script[1], import.meta.url), 'utf8');
  const css = await fs.readFile(new URL('../dist' + style[1], import.meta.url), 'utf8');
  assert.ok(js.includes('mapView:typeof window!=="undefined"&&window.matchMedia("(max-width: 680px)").matches?"wall":"space"'),
    'compiled runtime defaults to wall below 681px');
  assert.match(css, /@media\(max-width:980px\)\{\.search-composer input\{font-size:16px\}\}/,
    'mobile search inputs must be 16px to avoid iOS focus zoom');
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=/,
    'pinch-to-zoom must remain enabled');
});
