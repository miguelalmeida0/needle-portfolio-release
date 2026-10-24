import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.NEEDLE_BROWSER_ORIGIN || 'http://127.0.0.1:4173';
const profiles = [
  { name: 'desktop-xl', width: 1920, height: 1080, touch: false },
  { name: 'desktop', width: 1440, height: 900, touch: false },
  { name: 'laptop', width: 1024, height: 768, touch: false },
  { name: 'tablet', width: 768, height: 1024, touch: true },
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'phone-small', width: 375, height: 812, touch: true },
  { name: 'phone-compact', width: 320, height: 700, touch: false },
];

function assertLayout(info, name, phase) {
  const { viewport, header, brand, actions, search, nav, navBack, navNew, resultTiles, panel, pair, close, save, documentOverflow, compareOverflow, scrollViewport } = info;
  const visible = r => r && r.width > 0 && r.height > 0;
  const intersect = (a, b) => visible(a) && visible(b) && Math.min(a.right, b.right) - Math.max(a.left,b.left) > 2 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 2;
  const withinX = (r, container, label) => {
    assert.ok(r.left >= container.left - 3 && r.right <= container.right + 3, name + ' ' + phase + ': ' + label + ' outside container: ' + JSON.stringify({ r, container }));
  };
  assert.ok(documentOverflow <= 3, name + ' ' + phase + ': document scrolls horizontally by ' + documentOverflow + 'px');
  assert.ok(header && visible(header) && visible(brand) && visible(actions) && visible(search), name + ': essential header element absent');
  assert.ok(!intersect(brand, actions), name + ' ' + phase + ': brand overlaps actions');
  assert.ok(!intersect(brand, search), name + ' ' + phase + ': brand overlaps search');
  assert.ok(!intersect(search, actions), name + ' ' + phase + ': search overlaps actions');
  withinX(brand, viewport, 'brand');
  withinX(actions, viewport, 'header actions');
  withinX(search, viewport, 'search');
  assert.ok(!intersect(navBack, navNew), name + ' ' + phase + ': navigation buttons overlap');
  if (resultTiles?.length) {
    for (let i = 0; i < Math.min(8, resultTiles.length); i++) {
      for (let j = i+1; j < Math.min(8, resultTiles.length); j++) {
        assert.ok(!intersect(resultTiles[i], resultTiles[j]), name + ' ' + phase + ': artwork tiles ' + i + ' and ' + j + ' overlap');
      }
    }
  }
  if (panel) {
    assert.ok(visible(panel), name + ': comparison panel missing');
    withinX(panel, viewport, 'comparison panel');
    assert.ok(panel.top >= header.bottom - 3, name + ': comparison panel obscures header');
    assert.ok(compareOverflow <= 3, name + ': comparison panel overflows horizontally by ' + compareOverflow);
    assert.ok(pair?.length === 2 && visible(pair[0]) && visible(pair[1]), name + ': two artwork images not visible');
    assert.ok(!intersect(pair[0], pair[1]), name + ': compared images overlap');
    withinX(pair[0], panel, 'first artwork');
    withinX(pair[1], panel, 'second artwork');
    assert.ok(visible(close), name + ': dialog close is hidden');
    assert.ok(!intersect(close, search), name + ': dialog close overlaps search');
    assert.ok(visible(save), name + ': save control absent');
    assert.ok(save.width >= 120, name + ': save button too narrow');
    const availableScroll = scrollViewport?.height > 0 ? scrollViewport.height : panel.height;
    assert.ok(availableScroll > 150, name + ': insufficient comparison viewport');
  }
}

async function measure(page) {
  return await page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height || element.closest('[hidden]')) return null;
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
    };
    const tileRects = [...document.querySelectorAll('.needle-results:not([hidden]) .needle-artwork[data-artwork-id]')]
      .slice(0, 8).map(node => { const r=node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; });
    const images = [...document.querySelectorAll('.needle-compare-pair .needle-compare-art')].map(node => { const r=node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; });
    const root = document.documentElement;
    const panel = document.querySelector('.needle-compare-panel');
    return {
      viewport: {left:0,right:innerWidth,top:0,bottom:innerHeight,width:innerWidth,height:innerHeight},
      header: rect('.needle-header'),
      brand: rect('.needle-brand'),
      actions: rect('.needle-actions'),
      search: rect('.needle-header-search-slot:not([hidden]) .needle-search-host'),
      nav: rect('.needle-navigation'),
      navBack: rect('.needle-navigation button:first-child'),
      navNew: rect('.needle-navigation button:last-child'),
      resultTiles: tileRects,
      panel: rect('.needle-compare-panel'),
      pair: images,
      close: rect('.needle-compare-close'),
      save: rect('.needle-compare-save'),
      documentOverflow: root.scrollWidth - innerWidth,
      compareOverflow: panel ? panel.scrollWidth - panel.clientWidth : 0,
      scrollViewport: panel && {height:panel.clientHeight,scrollHeight:panel.scrollHeight},
    };
  });
}

const browser = await chromium.launch({headless: true, args:['--no-sandbox']});
let failures=0;
try {
  for (const p of profiles) {
    const page = await browser.newPage({
      viewport:{width:p.width,height:p.height},
      deviceScaleFactor:1,
      isMobile:p.touch,
      hasTouch:p.touch,
      reducedMotion:'reduce',
    });
    const errors=[];
    page.on('pageerror',error => errors.push(error.message));
    try {
      await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
      const search = page.locator('.needle-search input');
      await search.waitFor({state:'visible',timeout:30000});
      await search.fill('dogs');
      await search.press('Enter');
      await page.locator('#needle-results-title').waitFor({state:'visible',timeout:30000});
      await page.waitForFunction(() => document.querySelector('#needle-results-title')?.textContent?.trim()?.toLowerCase() === 'dogs', {timeout:30000});
      const art = page.locator('.needle-results:not([hidden]) .needle-artwork[data-artwork-id]');
      await art.first().waitFor({state:'visible',timeout:30000});
      await page.waitForFunction(() => document.querySelectorAll('.needle-compare-pick').length >= 2,{timeout:30000});
      assertLayout(await measure(page),p.name,'results');
      await page.screenshot({path:'/tmp/needle-layout-' + p.name + '-results.png',fullPage:false});
      const controls = page.locator('.needle-compare-pick');
      if(!p.touch && p.width>760) await art.first().hover();
      await controls.first().click({timeout:8000});
      assert.equal(await page.locator('.needle-compare-pick[aria-pressed="true"]').count(),1,p.name+': one selected state');
      if(!p.touch && p.width>760) await art.nth(1).hover();
      await controls.nth(1).click({timeout:8000});
      const panel = page.locator('[role="dialog"][aria-labelledby="needle-compare-title"]');
      await panel.waitFor({state:'visible',timeout:10000});
      assertLayout(await measure(page),p.name,'comparison');
      const activeInside = await page.evaluate(() => Boolean(document.activeElement?.closest('.needle-compare-panel')));
      assert.ok(activeInside,p.name+': focus did not enter dialog');
      if(!p.touch){
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('.needle-compare-panel'))),true,p.name+': focus escaped dialog');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('.needle-compare-panel'))),true,p.name+': focus escaped dialog on next Tab');
      }
      await page.screenshot({path:'/tmp/needle-layout-' + p.name + '-compare.png',fullPage:false});
      if(p.name === 'desktop'){
        await panel.getByRole('button',{name:'Save both works'}).click();
        await panel.getByText('Both artworks are in your saved collections.').waitFor({timeout:10000});
      }
      await panel.getByRole('button',{name:'Close artwork comparison'}).click();
      await panel.waitFor({state:'detached',timeout:10000});
      assertLayout(await measure(page),p.name,'close');
      assert.equal(await page.locator('.needle-compare-pick[aria-pressed="true"]').count(),0,p.name+': selection not cleared');
      assert.equal(await search.inputValue(),'dogs',p.name+': lost search query');
      await page.locator('.needle-map-action').click({timeout:8000});
      await page.locator('#needle-map-title').waitFor({state:'attached',timeout:10000});
      assert.ok(await page.locator('.needle-map-section').isVisible(),p.name+': map inaccessible');
      assert.ok(await search.isVisible(),p.name+': map search is hidden');
      assertLayout(await measure(page),p.name,'map');
      await page.locator('.needle-navigation button:first-child').click();
      await page.locator('#needle-results-title').waitFor({state:'visible',timeout:10000});
      assert.equal(await search.inputValue(),'dogs',p.name+': map navigation reset query');
      assert.deepEqual(errors,[],p.name+': browser Javascript errors');
      console.log('LAYOUT PASS',p.name,p.width+'x'+p.height,'header, grid, compare, focus, close, map');
    } catch(error){
      failures++;
      console.error('LAYOUT FAIL',p.name,error.stack||error);
      await page.screenshot({path:'/tmp/needle-layout-' + p.name + '-FAILED.png',fullPage:false}).catch(()=>{});
    } finally {await page.close();}
  }
} finally {await browser.close();}
if(failures)process.exitCode=1;
