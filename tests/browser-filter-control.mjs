import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.NEEDLE_BROWSER_ORIGIN ?? 'http://127.0.0.1:4173';
const profiles = [
  { name: 'desktop', width: 1440, height: 900, touch: false },
  { name: 'tablet', width: 768, height: 1024, touch: true },
  { name: 'mobile', width: 390, height: 844, touch: true },
  { name: 'compact', width: 320, height: 700, touch: false },
];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
let failures = 0;

try {
  for (const profile of profiles) {
    const page = await browser.newPage({
      viewport: { width: profile.width, height: profile.height },
      hasTouch: profile.touch,
      isMobile: profile.touch,
      reducedMotion: 'reduce',
    });
    try {
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const search = page.locator('.needle-search input');
      await search.waitFor({ state: 'visible', timeout: 30000 });
      await search.fill('dogs');
      await search.press('Enter');
      await page.locator('#needle-results-title').waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForFunction(
        () => document.querySelector('#needle-results-title')?.textContent?.trim().toLowerCase() === 'dogs',
        null,
        { timeout: 30000 },
      );
      await page.locator('.needle-artwork[data-artwork-id]').first().waitFor({ state: 'visible', timeout: 30000 });

      const filter = page.locator('.needle-results:not([hidden]) .needle-result-actions > button').first();
      await filter.waitFor({ state: 'visible', timeout: 15000 });
      const metrics = await filter.evaluate(button => {
        const rect = button.getBoundingClientRect();
        const icon = button.querySelector('svg')?.getBoundingClientRect();
        const labelRect = button.querySelector('.needle-filter-label')?.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          display: style.display, direction: style.flexDirection, alignItems: style.alignItems,
          whiteSpace: style.whiteSpace, height: rect.height, width: rect.width,
          gapBetweenCenters: icon && labelRect
            ? Math.abs((icon.top + icon.bottom) / 2 - (labelRect.top + labelRect.bottom) / 2) : null,
          withinViewport: rect.left >= 0 && rect.right <= innerWidth,
        };
      });
      assert.ok(['flex', 'inline-flex'].includes(metrics.display), profile.name + ': filter must use horizontal flex: ' + JSON.stringify(metrics));
      assert.equal(metrics.direction, 'row', profile.name + ': filter layout must remain horizontal');
      assert.equal(metrics.alignItems, 'center', profile.name + ': filter contents need vertical centering');
      assert.equal(metrics.whiteSpace, 'nowrap', profile.name + ': label must not wrap beneath icon');
      assert.ok(metrics.height >= 40 && metrics.height <= 46,
        profile.name + ': oversized filter control: ' + metrics.height + 'px');
      assert.ok(metrics.width >= 75 && metrics.width <= 140,
        profile.name + ': filter control is not compact: ' + metrics.width + 'px');
      assert.ok(metrics.gapBetweenCenters != null && metrics.gapBetweenCenters <= 3,
        profile.name + ': icon and label vertically misaligned: ' + JSON.stringify(metrics));
      assert.ok(metrics.withinViewport, profile.name + ': filter button beyond viewport');
      await page.screenshot({ path: '/tmp/needle-filter-' + profile.name + '.png' });
      await filter.screenshot({ path: '/tmp/needle-filter-' + profile.name + '-control.png' });
      await filter.click({ timeout: 7000 });
      assert.equal(await filter.getAttribute('aria-expanded'), 'true', profile.name + ': open state is not announced');
      await page.locator('.query-filter-menu[role="dialog"]').waitFor({ state: 'visible', timeout: 7000 });
      await page.keyboard.press('Escape');
      await page.locator('.query-filter-menu').waitFor({ state: 'detached', timeout: 7000 });
      assert.equal(await filter.getAttribute('aria-expanded'), 'false', profile.name + ': close state not restored');
      assert.ok(await page.locator('#needle-results-title').isVisible(), profile.name + ': results disappeared');
      console.log('PASS filter', profile.name, profile.width + 'x' + profile.height,
        metrics.width.toFixed(0) + 'x' + metrics.height.toFixed(0) + 'px');
    } catch (error) {
      failures++;
      console.error('FAIL filter', profile.name, error.stack || error);
      await page.screenshot({ path: '/tmp/needle-filter-' + profile.name + '-failure.png' }).catch(() => {});
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;
