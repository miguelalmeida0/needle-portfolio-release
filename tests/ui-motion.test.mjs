import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function fixture() {
  class Dialog extends EventTarget {
    dataset = {};
    isConnected = true;
    open = true;
    tagName = 'DIALOG';
  }
  const dialog = new Dialog();
  const document = { documentElement: { dataset: { ndInput: 'pointer' } }, addEventListener() {}, querySelector: () => dialog };
  const window = { SHAP: { React: {} } };
  vm.runInNewContext(fs.readFileSync('src/redesign/ui-controls.jsx', 'utf8').replace(/^import .*;$/m, 'const R = window.SHAP.React;').replace(/export \{[\s\S]*?\};/, 'window.NeedleUI = { Select, dismissOverlay, menuPlacement };'), {
    window, document, matchMedia: () => ({ matches: false }), setTimeout: fn => setTimeout(fn, 5), clearTimeout,
    requestAnimationFrame: fn => setTimeout(fn, 0),
  });
  return { dialog, document, dismiss: window.NeedleUI.dismissOverlay, place: window.NeedleUI.menuPlacement };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('pointer dismissal followed by Escape navigates only once', async () => {
  const { dismiss, document, dialog } = fixture();
  let count = 0;
  dismiss(() => count++);
  assert.equal(dialog.inert, true);
  document.documentElement.dataset.ndInput = 'keyboard';
  dismiss(() => count++);
  await settle();
  assert.equal(count, 1);
  assert.notEqual(dialog.inert, true);
});

test('closing a native dialog through history cancels pending dismissal', async () => {
  const { dismiss, dialog } = fixture();
  let count = 0;
  dismiss(() => count++);
  dialog.open = false;
  dialog.dispatchEvent(new Event('close'));
  await settle();
  assert.equal(count, 0);
  assert.equal(dialog.dataset.uiExiting, undefined);
});

test('an unmounted overlay cannot fire a stale navigation callback', async () => {
  const { dismiss, dialog } = fixture();
  let count = 0;
  dismiss(() => count++);
  dialog.isConnected = false;
  await settle();
  assert.equal(count, 0);
});


test('menu fits the dialog boundary even when viewport has more room', () => {
  const { place } = fixture();
  const p = place({ top: 530, bottom: 562, left: 600, width: 120 }, { top: 0, bottom: 900, left: 0, right: 1200 }, [{ top: 200, bottom: 580, left: 300, right: 850 }], { height: 890, width: 220 });
  assert.equal(p.above, true);
  assert.equal(p.maxHeight, 230);
});

test('menu clips its own scroll area to limited space with actual touch-row height', () => {
  const { place } = fixture();
  const p = place({ top: 270, bottom: 314, left: 280, width: 100 }, { top: 0, bottom: 844, left: 0, right: 390 }, [{ top: 200, bottom: 400, left: 10, right: 380 }], { height: 890, width: 220 });
  assert.equal(p.above, false);
  assert.equal(p.maxHeight, 80);
  assert.equal(p.left, -120);
});
