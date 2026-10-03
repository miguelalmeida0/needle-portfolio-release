const CACHE_VERSION = 1;
export function loadVisualCache(packId) {
    try {
        const raw = localStorage.getItem(cacheKey(packId));
        if (!raw)
            return new Map();
        const parsed = JSON.parse(raw);
        if (parsed.version !== CACHE_VERSION || !parsed.vectors)
            return new Map();
        return new Map(Object.entries(parsed.vectors).filter(([, vector]) => Array.isArray(vector) && vector.length > 0));
    }
    catch {
        return new Map();
    }
}
export function saveVisualCache(packId, vectors) {
    try {
        const payload = {
            version: CACHE_VERSION,
            vectors: Object.fromEntries(vectors)
        };
        localStorage.setItem(cacheKey(packId), JSON.stringify(payload));
    }
    catch {
        // Visual search remains functional for the current session when storage is unavailable.
    }
}
function cacheKey(packId) {
    return `needle.visual-preview.${CACHE_VERSION}.${packId}`;
}
//# sourceMappingURL=visual-cache.js.map