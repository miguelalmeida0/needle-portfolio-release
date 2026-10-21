import { selectDiscovery } from '../../../../src/core/discovery/select.js';
import { artworkById, matchesQueryFilters, visibleHits } from './app.selectors.js';
const empty = [];
const cache = new WeakMap();
export function discoveryItems(state) {
    if (!state.corpus || !state.discoveryReady || state.status !== 'ready' || state.errorMessage || state.queryKind !== 'text' ||
        !state.queryTerms.length || state.queryTerms.some(term => term.kind !== 'text'))
        return empty;
    const response = state.resultMode === 'truth' ? state.exact : state.approximate;
    if (!response)
        return empty;
    const keys = [state.corpus, state.queryTerms, state.queryFilters, state.scopedCollectionId, state.savedCollections, state.activeClusterId];
    const previous = cache.get(response);
    if (previous && keys.every((key, index) => key === previous.keys[index]))
        return previous.items;
    const scope = state.scopedCollectionId ? state.savedCollections.find(collection => collection.id === state.scopedCollectionId) : null;
    const ids = scope ? new Set(scope.artworkIds) : null;
    const items = selectDiscovery({
        hits: visibleHits(state), record: id => artworkById(state, id),
        positive: state.queryTerms.filter(term => term.polarity === 'positive').map(term => term.label),
        negative: state.queryTerms.filter(term => term.polarity === 'negative').map(term => term.label),
        accepts: artwork => matchesQueryFilters(artwork, state.queryFilters) && (!state.activeClusterId || artwork.clusterId === state.activeClusterId) &&
            (!state.scopedCollectionId || Boolean(ids?.has(artwork.id))),
    });
    // Collection persistence can replace metadata without changing these results.
    // Retain the rendered identity so it does not remount cards or replay motion.
    const stableItems = previous && items.length === previous.items.length &&
        items.every((item, index) => item.artwork === previous.items[index]?.artwork)
        ? previous.items : items;
    cache.set(response, { keys, items: stableItems });
    return stableItems.length ? stableItems : empty;
}
//# sourceMappingURL=discovery.selectors.js.map