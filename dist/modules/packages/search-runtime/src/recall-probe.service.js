export class RecallProbeService {
    #searchService;
    #sequence = 0;
    constructor(searchService) {
        this.#searchService = searchService;
    }
    async findWeakest(candidates, options) {
        if (candidates.length === 0)
            throw new Error('No truth-challenge queries were supplied.');
        let weakest = null;
        for (const candidate of candidates) {
            const sequence = ++this.#sequence;
            const approximate = await this.#searchService.search({
                requestId: `probe-fast-${sequence}`,
                vector: candidate.vector,
                k: options.k,
                efSearch: options.efSearch,
                exact: false,
                queryKind: 'text',
                queryText: candidate.text
            });
            const exact = await this.#searchService.search({
                requestId: `probe-truth-${sequence}`,
                vector: candidate.vector,
                k: options.k,
                efSearch: options.efSearch,
                exact: true,
                queryKind: 'text',
                queryText: candidate.text
            });
            const recall = calculateRecall(approximate, exact);
            const result = { ...candidate, approximate, exact, recall };
            if (!weakest || isWeaker(result, weakest))
                weakest = result;
            if (recall <= .625)
                break;
        }
        if (!weakest)
            throw new Error('Truth challenge did not produce a result.');
        return weakest;
    }
}
function calculateRecall(approximate, exact) {
    if (exact.hits.length === 0)
        return 1;
    const fastIds = new Set(approximate.hits.map((hit) => hit.id));
    return exact.hits.filter((hit) => fastIds.has(hit.id)).length / exact.hits.length;
}
function isWeaker(left, right) {
    if (left.recall !== right.recall)
        return left.recall < right.recall;
    if (left.approximate.inspectedRatio !== right.approximate.inspectedRatio) {
        return left.approximate.inspectedRatio < right.approximate.inspectedRatio;
    }
    return left.approximate.trace.distanceCalculations < right.approximate.trace.distanceCalculations;
}
//# sourceMappingURL=recall-probe.service.js.map