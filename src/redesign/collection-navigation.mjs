// Opening a collection is a new browsing context, not another query filter.
export function browseCollection(runtime, collectionId) {
  const state = runtime.store.getSnapshot();
  if (collectionId !== null && !state.savedCollections.some(item => item.id === collectionId)) return false;
  // Invalidate work already in flight before clearing the visible search state.
  runtime.setDraft('');
  runtime.store.dispatch({type:'TEXT_SEARCH_CLEARED'});
  runtime.store.dispatch({type:'QUERY_RECIPE_CHANGED',terms:[],filters:[],activeBranchId:null});
  runtime.setClusterFilter(null);
  runtime.clearCompare();
  void runtime.scopeCollection(collectionId);
  return true;
}
