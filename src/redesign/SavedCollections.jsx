import {React,useState,useEffect,useRef} from '../../dist/modules/apps/web/src/shared/react.js';
import {useAppRuntime,useAppState} from '../../dist/modules/apps/web/src/app/app.context.js';
import {visibleHits} from '../../dist/modules/apps/web/src/app/app.selectors.js';
import {Icon} from '../../dist/modules/apps/web/src/shared/icons.js';
import {ArtworkImage} from './GalleryImage.jsx';

export function SavedCollections({onOpenCollection}) {
  const runtime=useAppRuntime(),state=useAppState();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const byId=new Map(state.corpus?.items.map(item=>[item.id,item]) || []);
  const hits=visibleHits(state);
  async function saveResults(){
    if(busy)return;
    setBusy(true);setError('');
    const previous=new Set(state.savedCollections.map(item=>item.id));
    try{
      await runtime.saveCurrentCollection();
      const created=runtime.store.getSnapshot().savedCollections.find(item=>!previous.has(item.id));
      if(!created)throw Error('Your results could not be saved. Try again.');
      if(mounted.current)onOpenCollection(created.id);
    }catch(error){if(mounted.current)setError(error.message);}finally{if(mounted.current)setBusy(false);}
  }
  return <section className="nd-saved-library" aria-label="Your collections">
    {state.savedCollections.length ? <>
      <p className="nd-saved-intro">{state.savedCollections.length} {state.savedCollections.length===1?'collection':'collections'}</p>
      <div className="nd-saved-list">
        {state.savedCollections.map(collection=>{
          const artworks=collection.artworkIds.map(id=>byId.get(id)).filter(Boolean);
          return <button type="button" className="nd-saved-row" key={collection.id}
            onClick={()=>onOpenCollection(collection.id)} aria-label={`Open ${collection.name}, ${artworks.length} saved artworks`}>
            <span className="nd-saved-thumbnails" aria-hidden="true">
              {artworks.slice(0,3).map(artwork=><ArtworkImage key={artwork.id} role="map" src={artwork.thumbnailUrl||artwork.imageUrl}
                fallbackSrc={artwork.thumbnailFallbackUrls?.[0]} alt="" width={artwork.imageWidth} height={artwork.imageHeight} sizes="36px" />)}
            </span>
            <span className="nd-saved-name">{collection.name}<small>{artworks.length} {artworks.length===1?'artwork':'artworks'}{state.scopedCollectionId===collection.id?' · Open now':''}</small></span>
            <Icon name="arrow-right" size={15}/>
          </button>;
        })}
      </div>
    </> : <p className="nd-saved-empty">Save artwork from its details to find it here.</p>}
    {hits.length>0 && state.queryVector && <div className="nd-saved-footer">
      <button type="button" className="nd-button" disabled={busy} onClick={saveResults}>
        <Icon name="plus" size={14}/>{busy?'Saving…':'Save search as collection'}
      </button>
      <span>Up to 48 matching artworks</span>
    </div>}
    {error && <p role="alert" className="nd-error">{error}</p>}
  </section>;
}
