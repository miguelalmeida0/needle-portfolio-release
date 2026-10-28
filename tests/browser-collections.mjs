import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [1440,390,320]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',hasTouch:width===390});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!localStorage.getItem('needle.saved-collections.v1'))localStorage.setItem('needle.saved-collections.v1',JSON.stringify(Array.from({length:5},(_,i)=>({id:'saved-'+i,name:'Saved '+(i+1),artworkIds:['met-199528'],createdAt:1}))));});
  try {
   await page.goto(process.env.NEEDLE_BROWSER_ORIGIN||'http://127.0.0.1:4173');
   const input=page.locator('.needle-search input');
   await input.fill('cat');await input.press('Enter');
   await page.locator('.needle-artwork').first().waitFor({timeout:30000});
   const nav=page.getByRole('navigation',{name:'Main navigation'});
   await nav.getByRole('button',{name:'Saved',exact:true}).click();
   await page.getByRole('button',{name:'Open Saved 5, 1 saved artworks',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.needle-search input')?.value==='');
   await page.getByRole('heading',{name:'Saved 5',exact:true}).waitFor();
   await page.getByRole('button',{name:'Dog by Unknown maker',exact:true}).waitFor();
   assert.equal(await input.getAttribute('placeholder'),'Search this collection');
   const exit=page.getByRole('button',{name:'Browse all artworks',exact:true});
   const aligned=await exit.evaluate(el=>{const a=el.querySelector('span').getBoundingClientRect(),b=el.querySelector('svg').getBoundingClientRect();return Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<2;});
   assert.ok(aligned,'Collection exit icon and label share a line');
   await input.fill('cat');
   await page.getByText('No saved artworks match “cat”.',{exact:false}).waitFor({timeout:15000});
   await page.getByRole('button',{name:'Show all saved artworks'}).click();
   await page.getByRole('button',{name:'Dog by Unknown maker',exact:true}).waitFor();
   await exit.click();
   await page.getByRole('heading',{name:'The collection',exact:true}).waitFor();
   await input.fill('cat');
   await page.getByRole('button',{name:/Feeding Poor Puss by/}).first().click();
   const dialog=page.getByRole('dialog',{name:'Artwork details',exact:true});
   const select=dialog.getByRole('combobox',{name:'Save to collection'});
   await select.click();await select.press('End');await select.press('Enter');
   await dialog.getByRole('button',{name:'Save artwork',exact:true}).click();
   await dialog.getByRole('button',{name:'View collection',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.needle-search input')?.value==='');
   await page.getByRole('heading',{name:'Saved 5',exact:true}).waitFor();
   assert.equal(await page.locator('.needle-artwork').count(),2,'Saved artwork is visible alongside earlier saved work');
   assert.equal(await dialog.count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   assert.deepEqual(errors,[]);
   await page.screenshot({path:`/tmp/needle-collections-${width}.png`});
   console.log('COLLECTIONS PASS',width,'stale query, fifth collection, scoped search, reset, inline exit, save and view');
  } catch(error) {await page.screenshot({path:`/tmp/needle-collections-${width}-failure.png`});throw error;}
  finally{await page.close();}
 }
} finally{await browser.close();}
