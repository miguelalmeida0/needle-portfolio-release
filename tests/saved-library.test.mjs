import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

test('Saved lists every persisted collection so work in a fifth collection remains reachable',async()=>{
 let source=await readFile('src/redesign/SavedCollections.jsx','utf8');
 source=(await transform(source,{loader:'jsx',format:'esm'})).code.replace(/^import [\s\S]*? from [^;]+;\n/gm,'').replace(/^export \{[\s\S]*?\};?\s*$/m,'');
 const collections=Array.from({length:16},(_,i)=>({id:'collection-'+i,name:'Saved '+i,artworkIds:['dog'],color:'#ccc'}));
 const state={savedCollections:collections,corpus:{items:[{id:'dog',title:'Dog',imageUrl:'/dog.jpg'}]},queryFilters:[],approximate:null};
 const React={createElement:(type,props,...children)=>({type,props,children})};
 const component=new Function('React','Icon','ArtworkImage','useAppRuntime','useAppState','useState','visibleHits','useEffect','useRef',source+'\nreturn SavedCollections;')(React,()=>{},()=>{},()=>({}),()=>state,initial=>[initial,()=>{}],()=>[],()=>{},current=>({current}));
 const tree=component({onOpenCollection:()=>{}});const labels=[];
 const visit=node=>{if(Array.isArray(node))return node.forEach(visit);if(typeof node==='string')labels.push(node);else if(node?.children)visit(node.children);};visit(tree);
 for(const collection of collections)assert.ok(labels.includes(collection.name),collection.name+' must be reachable');
});

test('closing Saved while a search is saving does not reopen it or clear later work',async()=>{
 const source=(await transform(await readFile('src/redesign/SavedCollections.jsx','utf8'),{loader:'jsx',format:'esm'})).code.replace(/^import [\s\S]*? from [^;]+;\n/gm,'').replace(/^export \{[\s\S]*?\};?\s*$/m,'');
 let finish,cleanup;const opened=[];
 const state={savedCollections:[],corpus:{items:[]},queryVector:[1]};
 const runtime={saveCurrentCollection:()=>new Promise(resolve=>{finish=()=>{state.savedCollections=[{id:'new',name:'New',artworkIds:[]}];resolve();};}),store:{getSnapshot:()=>state}};
 const component=new Function('React','Icon','ArtworkImage','useAppRuntime','useAppState','useState','visibleHits','useEffect','useRef',source+'\nreturn SavedCollections;')({createElement:(type,props,...children)=>({type,props,children})},()=>{},()=>{},()=>runtime,()=>state,value=>[value,()=>{}],()=>[{id:'dog'}],fn=>{cleanup=fn();},current=>({current}));
 const nodes=[];const visit=node=>{if(Array.isArray(node))return node.forEach(visit);if(node?.children){nodes.push(node);visit(node.children);}};
 visit(component({onOpenCollection:id=>opened.push(id)}));
 const save=nodes.find(node=>node.type==='button'&&node.children.includes('Save search as collection'));
 assert.ok(save);const pending=save.props.onClick();cleanup();finish();await pending;
 assert.deepEqual(opened,[],'Late save completion must not change the new browsing context');
});
