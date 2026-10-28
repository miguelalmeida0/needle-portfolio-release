import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/redesign/detail-core.mjs';
test('crop stays inside image bounds with a nonzero region',()=>{assert.equal(typeof core.clampCrop,'function');assert.deepEqual(core.clampCrop({x:-.2,y:.9,width:2,height:.5}),{x:0,y:.9,width:1,height:.1});});
test('closest visual result comes first and excludes the source',()=>{assert.equal(typeof core.rank,'function');const a=Array(96).fill(0),b=Array(96).fill(.5);assert.deepEqual(core.rank(a,{1:a,2:b,3:a},1),[3,2]);});
test('failed image loads can be retried',async()=>{assert.equal(typeof core.loadImage,'function');let img;class FakeImage{constructor(){img=this}set src(v){}}const p=core.loadImage('https://images.test/a.jpg',{ImageClass:FakeImage,timeoutMs:50});img.onerror();await assert.rejects(p,/could not load/i);const q=core.loadImage('https://images.test/a.jpg',{ImageClass:FakeImage,timeoutMs:50});img.naturalWidth=100;img.onload();assert.equal(await q,img);});
test('image timeout rejects rather than loading forever',async()=>{assert.equal(typeof core.loadImage,'function');class FakeImage{set src(v){}}await assert.rejects(core.loadImage('https://images.test/a.jpg',{ImageClass:FakeImage,timeoutMs:5}),/too long/i);});
test('artwork image candidates preserve bundled image and deduplicate remote fallback',()=>{assert.equal(typeof core.imageSources,'function');assert.deepEqual(core.imageSources({imageUrl:'/packs/a.jpg',thumbnailUrl:'/packs/a.jpg',imageSourceUrl:'https://museum/a.jpg',thumbnailFallbackUrls:['https://museum/a.jpg']}),['/packs/a.jpg','https://museum/a.jpg']);});
test('image failure advances to next source',async()=>{assert.equal(typeof core.loadFirstImage,'function');const tried=[];class FakeImage{set src(v){tried.push(v);queueMicrotask(()=>{if(v==='bad')this.onerror();else{this.naturalWidth=100;this.onload()}})}}await core.loadFirstImage(['bad','good'],{ImageClass:FakeImage,timeoutMs:100});assert.deepEqual(tried,['bad','good']);});
test('compare state distinguishes selected and unselected artwork',()=>{assert.equal(typeof core.compareState,'function');assert.deepEqual(core.compareState(['met-1'],'met-1'),{selected:true,label:'Selected for comparison'});assert.deepEqual(core.compareState(['met-1'],'met-2'),{selected:false,label:'Compare'});});

test('the shipped detail index contains only real, locally available collection artwork', async()=>{
 const {readFile,stat}=await import('node:fs/promises');
 const items=JSON.parse(await readFile('dist/detail-assets/items.json','utf8'));
 const index=JSON.parse(await readFile('dist/detail-assets/visual-index.json','utf8'));
 const corpus=JSON.parse(await readFile('data-packs/met-10k-lean-v2/corpus.json','utf8'));
 const known=new Set(corpus.items.map(item=>item.objectId));
 assert.equal(items.length,262);assert.equal(new Set(items.map(item=>item.id)).size,items.length);
 for(const item of items){
  assert.ok(known.has(item.id)); assert.match(item.image,/^detail-assets\/\d+\.jpg$/);
  assert.ok((await stat('dist/'+item.image)).size>0);
  assert.equal(index[item.id]?.length,96);assert.ok(index[item.id].every(Number.isFinite));
 }
});
