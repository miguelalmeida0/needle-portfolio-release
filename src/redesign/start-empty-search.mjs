// The engine retains its original startup search. The opening input belongs to
// the visitor: don't leave the engine's demo sentence in their editable draft.
export async function startEmptySearch(runtime, root, location) {
  const opening = !location.hash || location.hash === '#home';
  let edited = false;
  const onEdit = () => { edited = true; };
  if (opening) {
    root.addEventListener('input', onEdit, true);
    root.addEventListener('compositionstart', onEdit, true);
  }
  try {
    await runtime.start();
    const state = runtime.store.getSnapshot();
    if (opening && !edited && state.corpus && state.draftQuery === state.corpus.defaultQuery.text) runtime.setDraft('');
  } finally {
    root.removeEventListener('input', onEdit, true);
    root.removeEventListener('compositionstart', onEdit, true);
  }
}
