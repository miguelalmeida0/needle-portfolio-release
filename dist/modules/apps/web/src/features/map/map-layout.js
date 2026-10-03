export const QUERY_COORDINATE = { x: .5, y: .48 };
export function resultCoordinate(rank, count) {
    const safeCount = Math.max(1, count);
    const angle = ((rank - 1) / safeCount) * Math.PI * 2 - Math.PI / 2;
    const alternating = rank % 2 === 0 ? 1 : .9;
    return {
        x: QUERY_COORDINATE.x + Math.cos(angle) * .205 * alternating,
        y: QUERY_COORDINATE.y + Math.sin(angle) * .225 * alternating
    };
}
export function buildDisplayCoordinates(items, hits, view) {
    const hitRanks = new Map(hits.map((hit) => [hit.id, hit.rank]));
    const resultCount = Math.max(1, hits.length);
    return new Map(items.map((item) => {
        const rank = hitRanks.get(item.id);
        const coordinate = view === 'focus' && rank
            ? resultCoordinate(rank, resultCount)
            : { x: item.x, y: item.y };
        return [item.id, coordinate];
    }));
}
//# sourceMappingURL=map-layout.js.map