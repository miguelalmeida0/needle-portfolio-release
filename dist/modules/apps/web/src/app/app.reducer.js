export const initialAppState = {
    status: 'booting',
    corpus: null,
    bootstrapRecordCount: 0,
    indexBuildProgress: { completed: 0, total: 0 },
    draftQuery: '',
    activeQuery: '',
    queryKind: 'text',
    queryArtworkId: null,
    selectedArtworkId: null,
    queryVector: null,
    queryTerms: [],
    queryFilters: [],
    approximate: null,
    exact: null,
    resultMode: 'fast',
    efSearch: 10,
    resultCount: 8,
    history: [],
    activeClusterId: null,
    uploadedPreviewUrl: null,
    rendererKind: 'pending',
    indexPhase: 'semantic',
    corpusImageProgress: { completed: 0, succeeded: 0, failed: 0, required: 0, total: 0 },
    visualIndexProgress: { completed: 0, total: 0, failures: 0 },
    mapView: 'space',
    challenge: null,
    savedCollections: [],
    branches: [],
    activeBranchId: null,
    scopedCollectionId: null,
    compareArtworkIds: [],
    detailSearchArtworkId: null,
    feedbackMessage: null,
    errorMessage: null
};
export function appReducer(state, event) {
    switch (event.type) {
        case 'CORPUS_DISCOVERED':
            return { ...state, bootstrapRecordCount: event.recordCount, indexBuildProgress: { completed: 0, total: event.recordCount } };
        case 'INDEX_BUILD_PROGRESS':
            return { ...state, indexBuildProgress: { completed: event.completed, total: event.total } };
        case 'CORPUS_IMAGES_PROGRESS':
            return {
                ...state,
                corpusImageProgress: {
                    completed: event.completed,
                    succeeded: event.succeeded,
                    failed: event.failed,
                    required: event.required,
                    total: event.total
                }
            };
        case 'BOOTSTRAP_READY':
            return {
                ...state,
                status: 'ready',
                corpus: event.corpus,
                draftQuery: event.corpus.defaultQuery.text,
                activeQuery: event.corpus.defaultQuery.text,
                queryKind: 'text',
                queryArtworkId: null,
                selectedArtworkId: null,
                history: event.history,
                savedCollections: event.collections,
                branches: event.branches,
                efSearch: event.corpus.items.length >= 5_000 ? 64 : event.corpus.items.length >= 1_000 ? 48 : 10,
                resultCount: event.corpus.items.length >= 1_000 ? 8 : state.resultCount,
                errorMessage: null
            };
        case 'BOOTSTRAP_FAILED':
            return { ...state, status: 'error', errorMessage: event.message };
        case 'SEARCH_FAILED':
            return { ...state, status: state.corpus ? 'ready' : 'error', errorMessage: event.message };
        case 'DRAFT_CHANGED':
            return { ...state, draftQuery: event.value };
        case 'QUERY_RECIPE_CHANGED':
            return {
                ...state,
                queryTerms: event.terms,
                queryFilters: event.filters,
                activeBranchId: event.activeBranchId === undefined ? state.activeBranchId : event.activeBranchId
            };
        case 'SEARCH_STARTED':
            return {
                ...state,
                status: 'searching',
                activeQuery: event.query,
                draftQuery: event.queryKind === 'text' ? event.query : state.draftQuery,
                queryKind: event.queryKind,
                queryVector: event.vector,
                queryArtworkId: event.artworkId,
                selectedArtworkId: event.preserveSelection ? state.selectedArtworkId : event.artworkId,
                approximate: null,
                exact: event.preserveTruth ? state.exact : null,
                resultMode: 'fast',
                uploadedPreviewUrl: event.uploadedPreviewUrl ?? null,
                challenge: null,
                errorMessage: null
            };
        case 'SEARCH_COMPLETED':
            return { ...state, status: 'ready', approximate: event.response, history: event.history, errorMessage: null };
        case 'TRUTH_STARTED':
            return { ...state, status: 'truth-checking', errorMessage: null };
        case 'TRUTH_COMPLETED':
            return { ...state, status: 'ready', exact: event.response, resultMode: 'truth', errorMessage: null };
        case 'PROBE_STARTED':
            return { ...state, status: 'probing', errorMessage: null, challenge: null };
        case 'PROBE_COMPLETED':
            return {
                ...state,
                status: 'ready',
                activeQuery: event.query,
                draftQuery: event.query,
                queryKind: 'text',
                queryVector: event.vector,
                queryArtworkId: null,
                selectedArtworkId: null,
                approximate: event.approximate,
                exact: event.exact,
                resultMode: 'truth',
                efSearch: event.efSearch,
                history: event.history,
                mapView: 'focus',
                queryTerms: [],
                queryFilters: [],
                challenge: { prompt: event.query, recall: event.exact.hits.length === 0 ? 1 : event.exact.hits.filter((hit) => event.approximate.hits.some((fast) => fast.id === hit.id)).length / event.exact.hits.length, efSearch: event.efSearch },
                uploadedPreviewUrl: null,
                errorMessage: null
            };
        case 'MODE_CHANGED':
            return { ...state, resultMode: event.mode };
        case 'MAP_VIEW_CHANGED':
            return { ...state, mapView: event.view };
        case 'ARTWORK_SELECTED':
            return { ...state, selectedArtworkId: event.artworkId, compareArtworkIds: state.compareArtworkIds.length === 1 && event.artworkId ? state.compareArtworkIds : state.compareArtworkIds };
        case 'EF_SEARCH_CHANGED':
            return { ...state, efSearch: event.value };
        case 'CLUSTER_FILTER_CHANGED':
            return { ...state, activeClusterId: event.clusterId };
        case 'RENDERER_READY':
            return { ...state, rendererKind: event.kind };
        case 'VISUAL_INDEX_STARTED':
            return { ...state, indexPhase: 'visualizing', visualIndexProgress: { completed: 0, total: event.total, failures: 0 } };
        case 'VISUAL_INDEX_PROGRESS':
            return { ...state, visualIndexProgress: { completed: event.completed, total: event.total, failures: event.failures } };
        case 'VISUAL_INDEX_READY':
            return {
                ...state, corpus: event.corpus, indexPhase: 'hybrid',
                visualIndexProgress: {
                    ...state.visualIndexProgress,
                    completed: event.corpus.items.filter((item) => item.visualVector?.length === event.corpus.embedding.visualDimensions).length
                }
            };
        case 'VISUAL_INDEX_FAILED':
            return { ...state, indexPhase: 'semantic-only' };
        case 'COLLECTIONS_CHANGED':
            return { ...state, savedCollections: event.collections };
        case 'BRANCHES_CHANGED':
            return { ...state, branches: event.branches, activeBranchId: event.activeBranchId };
        case 'COLLECTION_SCOPE_CHANGED':
            return { ...state, scopedCollectionId: event.collectionId };
        case 'COMPARE_CHANGED':
            return { ...state, compareArtworkIds: event.artworkIds };
        case 'DETAIL_SEARCH_CHANGED':
            return { ...state, detailSearchArtworkId: event.artworkId };
        case 'FEEDBACK_CHANGED':
            return { ...state, feedbackMessage: event.message };
        default:
            return state;
    }
}
//# sourceMappingURL=app.reducer.js.map