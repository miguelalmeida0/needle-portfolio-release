import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.NEEDLE_BROWSER_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  for (const profile of [
    {name:'desktop',width:1440,height:900,hasTouch:false,reducedMotion:'no-preference'},
    {name:'phone',width:390,height:844,hasTouch:true,reducedMotion:'reduce'},
    {name:'compact',width:320,height:700,hasTouch:false,reducedMotion:'reduce'},
  ]) {
    const page=await browser.newPage({viewport:{width:profile.width,height:profile.height},hasTouch:profile.hasTouch,isMobile:profile.hasTouch,reducedMotion:profile.reducedMotion});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Isolated test storage: exercise the real collection picker at its maximum persisted length.
    await page.addInitScript(()=>!localStorage.getItem('needle.saved-collections.v1') && localStorage.setItem('needle.saved-collections.v1',JSON.stringify(Array.from({length:16},(_,i)=>({id:'qa-'+i,name:'Collection '+String(i+1).padStart(2,'0'),artworkIds:['met-12538'],createdAt:1})))));
    try {
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      const input=page.getByRole('textbox',{name:'Describe something difficult to find'});
      await input.fill('dogs');await input.press('Enter');
      await page.locator('.needle-artwork').first().waitFor({state:'visible',timeout:30000});
      await input.fill('Scarab of Sebekhotep V'); // no Enter: automatic search
      await page.getByRole('heading',{name:'Scarab of Sebekhotep V',exact:true}).waitFor({state:'visible',timeout:15000});
      const artwork=page.getByRole('button',{name:/Scarab of Sebekhotep V by/}).first();
      await artwork.click();
      const dialog=page.getByRole('dialog',{name:'Artwork details',exact:true});
      await dialog.waitFor({state:'visible'});
      assert.equal(await page.locator('select').count(),0,'No native dropdowns');
      const select=dialog.getByRole('combobox',{name:'Save to collection'});
      await select.click();
      await dialog.getByRole('heading',{name:'Scarab of Sebekhotep V',exact:true}).click();
      assert.equal(await select.getAttribute('aria-expanded'),'false','Outside click closes picker');
      await select.press('ArrowDown');await select.press('End');await select.press('Enter');
      assert.match(await select.textContent(),/Collection 16/);
      await select.press('c');await select.press('Enter');
      assert.match(await select.textContent(),/Collection 01/,'Typeahead cycles to first matching collection');
      await select.press('End');await select.press('Enter');
      await select.click();await select.press('Escape');
      assert.equal(await select.getAttribute('aria-expanded'),'false');
      assert.equal(await dialog.isVisible(),true,'Picker Escape must not close artwork');
      await select.click();await select.press('Tab');
      assert.equal(await select.getAttribute('aria-expanded'),'false');
      await dialog.getByRole('button',{name:'Save artwork',exact:true}).click();
      await dialog.getByText('Artwork saved.',{exact:true}).waitFor();
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('needle.saved-collections.v1')));
      assert.ok(saved.find(c=>c.id==='qa-15').artworkIds.includes('met-552610'),'New membership persists in selected collection');
      assert.equal(saved.find(c=>c.id==='qa-0').artworkIds.includes('met-552610'),false,'Other collections remain unchanged');
      await page.reload({waitUntil:'domcontentloaded'});
      await dialog.getByRole('combobox',{name:'Save to collection'}).waitFor({state:'visible',timeout:30000});
      await select.press('End');await select.press('Enter');
      await dialog.getByRole('button',{name:'Saved',exact:true}).waitFor({state:'visible'});

      if(profile.name==='desktop') {
        await page.route('**/detail-assets/items.json',route=>route.fulfill({status:503,body:'Unavailable'}));
        await dialog.getByRole('button',{name:'Search a detail',exact:true}).click();
        await dialog.getByRole('alert').waitFor();
        assert.equal(await dialog.getByRole('button',{name:'Search a detail',exact:true}).isEnabled(),true,'Failed load can retry');
        await page.unroute('**/detail-assets/items.json');
      }
      await dialog.getByRole('button',{name:'Search a detail',exact:true}).click();
      await dialog.getByRole('button',{name:'Search this detail',exact:true}).waitFor({state:'visible',timeout:20000});
      const crop=dialog.locator('.nd-crop-box');
      const before=await crop.evaluate(el=>parseFloat(el.style.left));
      await dialog.getByRole('button',{name:'Move selection right',exact:true}).press('Enter');
      assert.ok(await crop.evaluate(el=>parseFloat(el.style.left))>before,'Keyboard crop movement changes selection');
      await dialog.getByRole('slider',{name:'Selection size'}).press('End');
      assert.ok(await crop.evaluate(el=>parseFloat(el.style.left)+parseFloat(el.style.width)<=100.001),'Maximum selection stays within image');
      await dialog.getByRole('button',{name:'Search this detail',exact:true}).click();
      await dialog.getByRole('heading',{name:'Similar details',exact:true}).waitFor();
      assert.equal(await dialog.locator('.nd-match').count(),12);
      await dialog.getByRole('button',{name:'Show more',exact:true}).click();
      assert.equal(await dialog.locator('.nd-match').count(),24);
      await dialog.locator('.nd-match').first().click();
      await dialog.getByRole('button',{name:'Search a detail',exact:true}).waitFor();
      const bounds=await dialog.boundingBox();
      assert.ok(bounds.x>=-1 && bounds.x+bounds.width<=profile.width+1,'Popup fits viewport');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
      await page.screenshot({path:'/tmp/needle-enhancements-'+profile.name+'.png'});
      await dialog.getByRole('button',{name:'Close artwork details'}).click();
      await dialog.waitFor({state:'hidden'});
      await input.fill('dogs');await page.locator('.needle-compare-pick').nth(1).waitFor({state:'attached',timeout:15000});
      const nav=page.getByRole('navigation',{name:'Main navigation',exact:true});
      await nav.getByRole('button',{name:'Compare',exact:true}).click();
      await nav.getByRole('status').waitFor();
      await page.getByRole('heading',{name:'dogs',exact:true}).click();
      await nav.getByRole('status').waitFor({state:'detached'});
      const picks=page.locator('.needle-compare-pick');
      await picks.nth(0).focus();await picks.nth(0).press('Enter');
      await picks.nth(1).focus();await picks.nth(1).press('Enter');
      const compare=page.locator('.needle-compare-panel');await compare.waitFor();
      await compare.getByRole('heading',{level:2}).click();
      assert.equal(await compare.isVisible(),true,'Inside click keeps Compare open');
      await page.mouse.click(20,20); // Header area is outside the panel at every breakpoint.
      await compare.waitFor({state:'detached'});
      assert.equal(await page.locator('.needle-compare-pick[aria-pressed="true"]').count(),0);
      assert.deepEqual(errors,[]);
      console.log('ENHANCEMENTS PASS',profile.name,'automatic search, popup, picker, save, detail retry/results, compare backdrop');
    } catch(error) {
      await page.screenshot({path:'/tmp/needle-enhancements-'+profile.name+'-failure.png'}).catch(()=>{});
      console.error('ENHANCEMENTS FAIL',profile.name,error);
      throw error;
    } finally {await page.close();}
  }
} finally {await browser.close();}
