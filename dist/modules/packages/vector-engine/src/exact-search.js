import { cosineDistance } from './distance.js';
export function exactSearch(entries, query, k) {
    const startedAt = performance.now();
    const ranked = entries
        .map((entry) => ({ id: entry.id, distance: cosineDistance(entry.vector, query) }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, k)
        .map((hit, index) => ({ ...hit, rank: index + 1 }));
    return {
        hits: ranked,
        trace: {
            entryPointId: entries[0]?.id ?? null,
            visitedIds: entries.map((entry) => entry.id),
            edges: [],
            distanceCalculations: entries.length,
            layersTraversed: 1
        },
        elapsedMs: performance.now() - startedAt,
        inspectedRatio: entries.length === 0 ? 0 : 1
    };
}
//# sourceMappingURL=exact-search.js.map