export function visibleArtworkNodes(options) {
    const byId = new Map(options.items.map((item) => [item.id, item]));
    const ids = new Set();
    const add = (id) => {
        if (id && id !== options.queryId && byId.has(id))
            ids.add(id);
    };
    for (const hit of options.hits)
        add(hit.id);
    add(options.selectedId);
    if (options.view === 'focus') {
        const tail = options.visitedIds.slice(-18);
        const entry = options.visitedIds.slice(0, 6);
        for (const id of [...entry, ...tail])
            add(id);
    }
    else {
        for (const item of balancedPreviewItems(options.items, options.previewLimit))
            add(item.id);
        for (const id of options.visitedIds.slice(-12))
            add(id);
    }
    const hitRanks = new Map(options.hits.map((hit) => [hit.id, hit.rank]));
    return [...ids]
        .map((id) => byId.get(id))
        .filter((item) => Boolean(item))
        .sort((left, right) => {
        const leftHit = hitRanks.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightHit = hitRanks.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftHit - rightHit
            || (left.previewRank ?? Number.MAX_SAFE_INTEGER) - (right.previewRank ?? Number.MAX_SAFE_INTEGER)
            || left.id.localeCompare(right.id);
    });
}
function balancedPreviewItems(items, limit) {
    const eligible = items
        .filter((item) => item.previewRank && item.previewRank <= Math.max(limit * 5, limit))
        .sort((left, right) => (left.previewRank ?? Number.MAX_SAFE_INTEGER) - (right.previewRank ?? Number.MAX_SAFE_INTEGER));
    const groups = new Map();
    for (const item of eligible) {
        const group = groups.get(item.clusterId) ?? [];
        group.push(item);
        groups.set(item.clusterId, group);
    }
    const result = [];
    let level = 0;
    while (result.length < limit) {
        let added = false;
        for (const group of groups.values()) {
            const item = group[level];
            if (!item)
                continue;
            result.push(item);
            added = true;
            if (result.length >= limit)
                break;
        }
        if (!added)
            break;
        level += 1;
    }
    return result;
}
//# sourceMappingURL=map-visibility.js.map