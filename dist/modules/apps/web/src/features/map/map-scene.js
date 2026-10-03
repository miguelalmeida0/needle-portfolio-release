import { QUERY_COORDINATE } from './map-layout.js';
function pseudo(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}
export function buildAmbientPoints(clusters) {
    const points = [];
    for (const [clusterIndex, cluster] of clusters.entries()) {
        for (let index = 0; index < 38; index += 1) {
            const angle = pseudo(clusterIndex * 97 + index * 11) * Math.PI * 2;
            const radius = Math.sqrt(pseudo(clusterIndex * 211 + index * 17)) * 0.13;
            points.push({
                id: `ambient-${cluster.id}-${index}`,
                x: Math.max(0.02, Math.min(0.98, cluster.center.x + Math.cos(angle) * radius)),
                y: Math.max(0.03, Math.min(0.97, cluster.center.y + Math.sin(angle) * radius * 0.78)),
                clusterColor: cluster.color,
                highlighted: false,
                visited: false
            });
        }
    }
    return points;
}
export function buildConnections(items, hits, traceEdges, coordinates, featuredNeighborId = null) {
    const itemIds = new Set(items.map((item) => item.id));
    const connections = [];
    for (const edge of traceEdges.filter((candidate) => candidate.accepted).slice(0, 140)) {
        if (!itemIds.has(edge.fromId) || !itemIds.has(edge.toId))
            continue;
        const from = coordinates.get(edge.fromId);
        const to = coordinates.get(edge.toId);
        if (!from || !to)
            continue;
        connections.push({ fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, emphasis: 'trace' });
    }
    for (const hit of hits) {
        if (hit.id === featuredNeighborId)
            continue;
        const item = coordinates.get(hit.id);
        if (!item)
            continue;
        connections.push({
            fromX: QUERY_COORDINATE.x,
            fromY: QUERY_COORDINATE.y,
            toX: item.x,
            toY: item.y,
            emphasis: 'neighbor'
        });
    }
    return connections;
}
//# sourceMappingURL=map-scene.js.map