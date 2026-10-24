import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.NEEDLE_BROWSER_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
let failure = false;
try {
  for (const profile of [
    { label: 'desktop', width: 1440, height: 900, hasTouch: false },
    { label: 'mobile-touch', width: 390, height: 844, hasTouch: true },
    { label: 'narrow-pointer', width: 390, height: 844, hasTouch: false },
  ]) {
    const page = await browser.newPage({
      viewport: { width: profile.width, height: profile.height },
      isMobile: profile.hasTouch,
      hasTouch: profile.hasTouch,
      reducedMotion: 'reduce',
    });
    const label = profile.label;
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
    try {
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const input = page.locator('.needle-search input');
      await input.waitFor({ state: 'visible', timeout: 30000 });
      await input.fill('dogs');
      await input.press('Enter');
      await page.locator('#needle-results-title').waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForFunction(() => {
        const title = document.querySelector('#needle-results-title');
        return title?.textContent?.trim()?.toLowerCase() === 'dogs';
      }, { timeout: 30000 });
      const items = page.locator('.needle-artwork[data-artwork-id]');
      await items.first().waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForFunction(() => document.querySelectorAll('.needle-compare-pick').length >= 2, { timeout: 30000 });
      const originals = await items.count();
      assert.ok(originals >= 2, 'Expected at least two genuine results');
      const firstId = await items.nth(0).getAttribute('data-artwork-id');
      const secondId = await items.nth(1).getAttribute('data-artwork-id');
      assert.ok(firstId && secondId && firstId !== secondId, 'Comparison requires two distinct real artworks');
      if (label === 'desktop') await items.first().hover();
      await page.locator('.needle-compare-pick').nth(0).click();
      await page.getByText('1 selected · Choose another artwork to compare').waitFor({ state: 'visible', timeout: 5000 });
      if (label === 'desktop') await items.nth(1).hover();
      await page.locator('.needle-compare-pick').nth(1).click();
      const panel = page.locator('[role="dialog"][aria-labelledby="needle-compare-title"]');
      await panel.waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await panel.locator('.needle-compare-work').count(), 2);
      assert.equal(await panel.locator('.needle-compare-art img').count(), 2);
      assert.ok((await panel.locator('.needle-compare-connection').innerText()).length > 35);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 3);
      assert.equal(overflow, false, 'No document horizontal overflow');
      await page.screenshot({ path: '/tmp/needle-compare-' + label + '.png' });

      if (label === 'desktop') {
        await panel.getByRole('button', { name: 'Save both works' }).click();
        await panel.getByText('Both artworks are in your saved collections.').waitFor({ timeout: 10000 });
        await panel.getByRole('button', { name: 'Close artwork comparison' }).click();
      } else {
        await page.keyboard.press('Escape');
      }
      await panel.waitFor({ state: 'detached', timeout: 10000 });
      await items.first().waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('.needle-compare-pick[aria-pressed="true"]').count(), 0);
      console.log('PASS:', label, 'results, two real selections, comparison, close and viewport');
    } catch (err) {
      failure = true;
      console.error('FAIL:', label, err.stack || err);
      await page.screenshot({ path: '/tmp/needle-compare-' + label + '-failure.png' }).catch(() => {});
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failure) process.exitCode = 1;
