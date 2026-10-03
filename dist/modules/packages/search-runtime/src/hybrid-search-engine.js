import { cosineDistance, exactSearch, HnswIndex } from '../../vector-engine/src/index.js';
import { LexicalIndex } from './lexical-index.js';
export class HybridSearchEngine {
    #entries;
    #entryById;
    #documentById;
    #index;
    #lexical;
    constructor(entries, documents, onProgress = () => undefined, snapshot) {
        this.#entries = entries;
        this.#entryById = new Map(entries.map((entry) => [entry.id, entry]));
        this.#documentById = new Map(documents.map((document) => [document.id, document]));
        this.#lexical = new LexicalIndex(documents);
        this.#index = new HnswIndex({
            dimensions: entries[0]?.vector.length ?? 0,
            maxConnections: entries.length >= 5_000 ? 12 : 8,
            efConstruction: entries.length >= 5_000 ? 96 : 64,
            seed: 1
        });
        if (snapshot) {
            this.#index.restore(snapshot, entries);
            onProgress(entries.length, entries.length);
            return;
        }
        for (const [entryIndex, entry] of entries.entries()) {
            this.#index.add(entry.id, entry.vector);
            const completed = entryIndex + 1;
            if (completed === entries.length || completed % Math.max(100, Math.floor(entries.length / 100)) === 0) {
                onProgress(completed, entries.length);
            }
        }
    }
    snapshot() { return this.#index.snapshot(); }
    search(request) {
        const query = Float32Array.from(request.vector);
        const queryText = request.queryKind === 'text' ? request.queryText?.trim() ?? '' : '';
        const hasFilters = Boolean(request.filters && Object.keys(request.filters).length > 0);
        if (!queryText && !hasFilters) {
            return request.exact
                ? exactSearch(this.#entries, query, request.k)
                : this.#index.search(query, request.k, request.efSearch);
        }
        if (!queryText) {
            return request.exact
                ? this.#exactVectorSearch(query, request.k, request.filters)
                : this.#approximateVectorSearch(query, request.k, request.efSearch, request.filters);
        }
        return request.exact
            ? this.#exactTextSearch(query, queryText, request.k, request.filters)
            : this.#approximateTextSearch(query, queryText, request.k, request.efSearch, request.filters);
    }
    #approximateVectorSearch(query, k, efSearch, filters) {
        const startedAt = performance.now();
        const semantic = this.#index.search(query, Math.max(k, Math.min(96, k * 8)), Math.max(efSearch, k * 3));
        const candidateIds = new Set(semantic.trace.visitedIds);
        for (const hit of semantic.hits)
            candidateIds.add(hit.id);
        this.#supplementFilteredCandidates(candidateIds, filters, k);
        const hits = this.#scoreCandidates(query, candidateIds, new Map(), k, filters, false);
        return {
            hits,
            trace: semantic.trace,
            elapsedMs: Math.max(0.01, performance.now() - startedAt),
            inspectedRatio: Math.min(1, candidateIds.size / Math.max(1, this.#entries.length))
        };
    }
    #exactVectorSearch(query, k, filters) {
        const startedAt = performance.now();
        const candidateIds = new Set(this.#entries.map((entry) => entry.id));
        const hits = this.#scoreCandidates(query, candidateIds, new Map(), k, filters, false);
        return {
            hits,
            trace: {
                entryPointId: null,
                visitedIds: this.#entries.map((entry) => entry.id),
                edges: [],
                distanceCalculations: this.#entries.length,
                layersTraversed: 1
            },
            elapsedMs: Math.max(0.01, performance.now() - startedAt),
            inspectedRatio: 1
        };
    }
    #approximateTextSearch(query, queryText, k, efSearch, filters) {
        const startedAt = performance.now();
        const semantic = this.#index.search(query, Math.max(k, Math.min(96, k * 6)), Math.max(efSearch, k * 3));
        const lexicalHits = this.#lexical.search(queryText, Math.max(64, Math.min(256, efSearch * 3)));
        const lexicalScores = new Map(lexicalHits.map((hit) => [hit.id, hit.score]));
        const candidateIds = new Set(semantic.trace.visitedIds);
        for (const hit of semantic.hits)
            candidateIds.add(hit.id);
        for (const hit of lexicalHits)
            candidateIds.add(hit.id);
        this.#supplementFilteredCandidates(candidateIds, filters, k);
        const hits = this.#scoreCandidates(query, candidateIds, lexicalScores, k, filters, true);
        return {
            hits,
            trace: semantic.trace,
            elapsedMs: Math.max(0.01, performance.now() - startedAt),
            inspectedRatio: Math.min(1, candidateIds.size / Math.max(1, this.#entries.length))
        };
    }
    #exactTextSearch(query, queryText, k, filters) {
        const startedAt = performance.now();
        const lexicalHits = this.#lexical.search(queryText, this.#entries.length);
        const lexicalScores = new Map(lexicalHits.map((hit) => [hit.id, hit.score]));
        const candidateIds = new Set(this.#entries.map((entry) => entry.id));
        const hits = this.#scoreCandidates(query, candidateIds, lexicalScores, k, filters, true);
        return {
            hits,
            trace: {
                entryPointId: null,
                visitedIds: this.#entries.map((entry) => entry.id),
                edges: [],
                distanceCalculations: this.#entries.length,
                layersTraversed: 1
            },
            elapsedMs: Math.max(0.01, performance.now() - startedAt),
            inspectedRatio: 1
        };
    }
    #supplementFilteredCandidates(candidateIds, filters, k) {
        if (!filters)
            return;
        let matches = 0;
        for (const id of candidateIds)
            if (this.#matchesFilters(id, filters))
                matches += 1;
        if (matches >= k)
            return;
        // Filtered retrieval is product-facing: if the ANN frontier does not contain
        // enough valid records, widen deterministically rather than returning an empty UI.
        for (const entry of this.#entries) {
            if (this.#matchesFilters(entry.id, filters))
                candidateIds.add(entry.id);
        }
    }
    #scoreCandidates(query, candidateIds, lexicalScores, k, filters, hybrid) {
        const scored = [];
        for (const id of candidateIds) {
            if (filters && !this.#matchesFilters(id, filters))
                continue;
            const entry = this.#entryById.get(id);
            if (!entry)
                continue;
            const semanticScore = clamp01(1 - cosineDistance(query, entry.vector));
            const lexicalScore = lexicalScores.get(id) ?? 0;
            const score = hybrid
                ? lexicalScore > 0
                    ? semanticScore * .38 + lexicalScore * .62
                    : semanticScore * .94
                : semanticScore;
            scored.push({ id, score });
        }
        scored.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
        return scored.slice(0, Math.max(1, k)).map((candidate, index) => ({
            id: candidate.id,
            distance: 1 - clamp01(candidate.score),
            rank: index + 1
        }));
    }
    #matchesFilters(id, filters) {
        const document = this.#documentById.get(id);
        if (!document)
            return false;
        if (filters.ids?.length && !filters.ids.includes(id))
            return false;
        if (filters.clusterIds?.length && !filters.clusterIds.includes(document.clusterId))
            return false;
        if (filters.cultures?.length && !matchesOne(document.culture, filters.cultures))
            return false;
        if (filters.departments?.length && !matchesOne(document.department, filters.departments))
            return false;
        if (filters.mediums?.length && !matchesOne(document.medium, filters.mediums))
            return false;
        if (filters.classifications?.length && !matchesOne(document.classification, filters.classifications))
            return false;
        if (typeof filters.yearBefore === 'number' && (document.year === null || document.year >= filters.yearBefore))
            return false;
        if (typeof filters.yearAfter === 'number' && (document.year === null || document.year <= filters.yearAfter))
            return false;
        return true;
    }
}
function matchesOne(value, accepted) {
    const normalized = value.trim().toLowerCase();
    if (!normalized)
        return false;
    return accepted.some((candidate) => {
        const expected = candidate.trim().toLowerCase();
        if (!expected)
            return false;
        return normalized === expected || normalized.includes(expected);
    });
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
//# sourceMappingURL=hybrid-search-engine.js.map