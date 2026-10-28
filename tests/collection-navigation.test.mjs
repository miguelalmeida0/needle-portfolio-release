import test from 'node:test';
import assert from 'node:assert/strict';
import {AppRuntime} from '../dist/modules/apps/web/src/app/app.runtime.js';
import {SearchService} from '../dist/modules/packages/search-runtime/src/search.service.js';
import {scopedCorpusItems} from '../dist/modules/apps/web/src/app/app.selectors.js';

import {browseCollection} from '../src/redesign/collection-navigation.mjs';
function fixture(t){
 const runtime=new AppRuntime();t.after(()=>runtime.dispose());
 runtime.store.dispatch({type:'BOOTSTRAP_READY',corpus:{items:[{id:'dog',title:'Dog'},{id:'cat',title:'Cat'}],defaultQuery:{text:'cat',exemplarArtworkId:'cat'}},history:[],collections:[{id:'saved',name:'Collection 1',artworkIds:['dog']}],branches:[]});
 return runtime;
}
function worker(t,search){const original=SearchService.prototype.search;SearchService.prototype.search=search;t.after(()=>SearchService.prototype.search=original);}
const empty=()=>({hits:[],latencyMs:1,mode:'fast',relevance:{version:'catalogue-v2',status:'no-match'}});

test('opening saved work clears an unrelated query and filters instead of hiding the saved artwork',async t=>{
 worker(t,async()=>empty());const runtime=fixture(t);
 runtime.setDraft('cat');await runtime.submitDraft(false);
 runtime.store.dispatch({type:'QUERY_RECIPE_CHANGED',terms:runtime.store.getSnapshot().queryTerms,filters:[{id:'medium:gold',field:'medium',value:'gold'}]});
 runtime.setClusterFilter('paintings');runtime.store.dispatch({type:'COMPARE_CHANGED',artworkIds:['cat']});
 await browseCollection(runtime,'saved');const state=runtime.store.getSnapshot();
 assert.equal(state.draftQuery,'');assert.equal(state.activeQuery,'');
 assert.deepEqual(state.queryFilters,[]);assert.equal(state.activeClusterId,null);assert.deepEqual(state.compareArtworkIds,[]);
 assert.equal(state.scopedCollectionId,'saved');assert.deepEqual(scopedCorpusItems(state).map(a=>a.id),['dog']);
});
test('a late search response cannot replace an opened collection',async t=>{
 const pendingResponses=[];worker(t,()=>new Promise(done=>pendingResponses.push(done)));const runtime=fixture(t);
 runtime.setDraft('cat');const pending=runtime.submitDraft(false);
 const opened=browseCollection(runtime,'saved');pendingResponses.forEach(resolve=>resolve(empty()));await pending;await opened;
 const state=runtime.store.getSnapshot();assert.equal(state.activeQuery,'');assert.equal(state.approximate,null);assert.equal(state.status,'ready');
});
test('leaving a collection also clears its search so all artwork is reachable',async t=>{
 worker(t,async()=>empty());const runtime=fixture(t);await runtime.scopeCollection('saved');runtime.setDraft('cat');await runtime.submitDraft(false);
 await browseCollection(runtime,null);const state=runtime.store.getSnapshot();assert.equal(state.scopedCollectionId,null);assert.equal(state.activeQuery,'');assert.deepEqual(scopedCorpusItems(state).map(a=>a.id),['dog','cat']);
});
test('a missing collection does not erase the current search',async t=>{
 worker(t,async()=>empty());const runtime=fixture(t);runtime.setDraft('cat');await runtime.submitDraft(false);
 assert.equal(await browseCollection(runtime,'deleted'),false);assert.equal(runtime.store.getSnapshot().activeQuery,'cat');assert.equal(runtime.store.getSnapshot().scopedCollectionId,null);
});
