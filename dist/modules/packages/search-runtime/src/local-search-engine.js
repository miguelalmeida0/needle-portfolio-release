import { HybridSearchEngine } from './hybrid-search-engine.js';
export class LocalSearchEngine {
    #engine;
    constructor(items) {
        const entries = items.map((item) => ({ id: item.id, vector: Float32Array.from(item.vector) }));
        this.#engine = new HybridSearchEngine(entries, items.map(toSearchDocument));
    }
    search(request) {
        return this.#engine.search(request);
    }
}
export function toSearchDocument(item) {
    return {
        id: item.id,
        year: item.year,
        clusterId: item.clusterId,
        title: item.title,
        tags: item.tags,
        objectName: item.objectName,
        classification: item.classification,
        medium: item.medium,
        department: item.department,
        culture: item.culture,
        period: item.period,
        creator: item.creator
    };
}
//# sourceMappingURL=local-search-engine.js.map