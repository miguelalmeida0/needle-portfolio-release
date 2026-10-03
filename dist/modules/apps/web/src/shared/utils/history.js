const KEY = 'needle.recent-queries.v1';
export function loadHistory() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((entry) => Boolean(entry) && typeof entry === 'object'
            && typeof entry.id === 'string' && typeof entry.text === 'string'
            && typeof entry.artworkId === 'string'
            && typeof entry.searchedAt === 'number' && Number.isFinite(entry.searchedAt)).slice(0, 6) : [];
    }
    catch {
        return [];
    }
}
export function saveHistory(entries) {
    try {
        localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 6)));
    }
    catch {
        // Storage is optional; the in-memory experience remains functional.
    }
}
//# sourceMappingURL=history.js.map