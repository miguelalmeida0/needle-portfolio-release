import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const origin='http://127.0.0.1:4180';
const manifest=JSON.parse(await readFile(new URL('../dist/redesign-release.json',import.meta.url),'utf8'));
let response;
for(let attempt=0;attempt<30;attempt++){
  try{response=await fetch(origin,{signal:AbortSignal.timeout(2000)});if(response.ok)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(response?.ok,'Production container must serve the homepage');
const html=await response.text();
for(const key of ['bootstrap','stylesheet','searchWorker']){
 const path=manifest[key];if(key!=='searchWorker')assert.ok(html.includes(path));
 const asset=await fetch(origin+path);assert.equal(asset.status,200,path);
 assert.equal(createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex'),manifest[key+'Sha256'],path);
}
const itemsResponse=await fetch(origin+'/detail-assets/items.json');assert.equal(itemsResponse.status,200);
const items=await itemsResponse.json();assert.equal(items.length,262);
const indexResponse=await fetch(origin+'/detail-assets/visual-index.json');assert.equal(indexResponse.status,200);
const index=await indexResponse.json();assert.equal(index[items[0].id].length,96);
const image=await fetch(origin+'/'+items[0].image);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/jpeg/);
assert.ok((await image.arrayBuffer()).byteLength>0);
console.log('Container smoke passed: homepage, exact JS/CSS/worker hashes, detail data and image delivery.');
