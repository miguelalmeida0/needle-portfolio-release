export function searchCacheKey(request) {
    const filters = Object.entries(request.filters ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, Array.isArray(value) ? [...value].map(item => key === 'ids' || key === 'clusterIds' ? String(item) : String(item).trim().toLowerCase()).sort() : value]);
    return JSON.stringify([request.vector, request.k, request.efSearch, request.exact, request.queryKind,
        request.queryText?.trim().toLowerCase(), filters]);
}
export class SearchCache {
    capacity;
    #entries = new Map();
    constructor(capacity = 24) {
        this.capacity = capacity;
    }
    get(key) {
        const value = this.#entries.get(key);
        if (value) {
            this.#entries.delete(key);
            this.#entries.set(key, value);
        }
        return value;
    }
    set(key, value) {
        this.#entries.delete(key);
        this.#entries.set(key, value);
        while (this.#entries.size > this.capacity)
            this.#entries.delete(this.#entries.keys().next().value);
    }
    clear() { this.#entries.clear(); }
}
//# sourceMappingURL=search-cache.js.map