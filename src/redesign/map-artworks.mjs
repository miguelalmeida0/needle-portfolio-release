import { activeCollection, scopedCorpusItems, visibleHits } from '../../dist/modules/apps/web/src/app/app.selectors.js';
import { visibleArtworkNodes } from '../../dist/modules/apps/web/src/features/map/map-visibility.js';

// A collection remains browsable after search is cleared. The original map's
// global preview ranks don't cover arbitrary saved artworks, so fill its bounded
// presentation sample with real scoped items. Search hits keep their order.
export function mapArtworks(state, previewLimit = 120) {
  const items = scopedCorpusItems(state);
  const nodes = visibleArtworkNodes({
    items, hits: visibleHits(state),
    visitedIds: state.approximate?.trace?.visitedIds ?? [],
    selectedId: state.selectedArtworkId, queryId: null,
    view: 'space', previewLimit,
  });
  if (activeCollection(state) || nodes.length === 0) {
    const seen = new Set(nodes.map(item => item.id));
    for (const item of items) {
      if (nodes.length >= previewLimit) break;
      if (!seen.has(item.id)) { seen.add(item.id); nodes.push(item); }
    }
  }
  return nodes;
}
