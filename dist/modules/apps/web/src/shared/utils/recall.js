export function calculateRecall(approximate, exact) {
    if (exact.length === 0)
        return null;
    const approximateIds = new Set(approximate.map((hit) => hit.id));
    return exact.filter((hit) => approximateIds.has(hit.id)).length / exact.length;
}
//# sourceMappingURL=recall.js.map