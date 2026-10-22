import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { ArtEmbeddingSpace } from '../dist/modules/packages/query-encoder/src/art-embedding-space.js';
import { build } from 'esbuild';
import { searchRelevance } from '../scripts/search-relevance.mjs';

test('the shipped browser worker executes the corrected engine', async t => {
  const manifest = JSON.parse(await readFile(new URL('../dist/redesign-release.json', import.meta.url)));
  const code = await readFile(new URL('../dist' + manifest.searchWorker, import.meta.url), 'utf8');
  const bridge = `const {parentPort}=require('node:worker_threads');const self={postMessage:m=>parentPort.postMessage(m)};parentPort.on('message',data=>self.onmessage({data}));`;
  const worker = new Worker(bridge + code, { eval: true });
  t.after(() => worker.terminate());
  const next = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Worker reply timed out')), 5000);
    const onMessage = message => { if (message.type === 'progress') return; clearTimeout(timer); worker.off('message', onMessage); resolve(message); };
    worker.on('message', onMessage); worker.once('error', reject);
  });
  const space = new ArtEmbeddingSpace();
  const documents = [{ id:'actress',title:'Emma Carson',tags:['portrait'] }, { id:'car',title:'Red car',tags:['car'] }]
    .map(item=>({creator:'',medium:'',classification:'',objectName:'',department:'',culture:'',period:'',objectDate:'',clusterId:'test',year:1900,...item}));
  const vectors = new Float32Array(documents.flatMap(document => [...space.encodeArtwork(document)]));
  let reply = next(); worker.postMessage({type:'initialize',ids:documents.map(i=>i.id),dimensions:space.dimensions.length,vectors,documents});
  assert.equal((await reply).type, 'ready');
  for (const [queryText, expected] of [['cars',['car']], ['smartphones',[]], ['Emma Carson',['actress']]]) {
    reply = next(); worker.postMessage({type:'search',payload:{requestId:queryText,queryKind:'text',queryText,vector:[...space.encodeText(queryText)],k:8,efSearch:64,exact:false}});
    const result = await reply;
    assert.equal(result.type,'result');
    assert.deepEqual(result.payload.hits.map(hit=>hit.id),expected);
    assert.equal(result.payload.relevance.version,'catalogue-v2');
  }
});

test('the production local fallback resolves to the same corrected engine', async () => {
  const result = await build({entryPoints:['src/redesign/bootstrap.jsx'],bundle:true,write:false,format:'esm',metafile:true,
    define:{__NEEDLE_SEARCH_WORKER_URL__:'"/worker.js"'},plugins:[searchRelevance]});
  const fallback=result.metafile.inputs['dist/modules/packages/search-runtime/src/local-search-engine.js'];
  assert.ok(fallback.imports.some(item=>item.path==='src/search/hybrid-search-engine.mjs'));
});
