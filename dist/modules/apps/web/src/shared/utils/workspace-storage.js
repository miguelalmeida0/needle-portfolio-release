import { EMBEDDING_DIMENSIONS, SEMANTIC_VECTOR_LENGTH } from '../../../../../packages/query-encoder/src/embedding-schema.js';
const COLLECTIONS_KEY = 'needle.saved-collections.v1';
const BRANCHES_KEY = 'needle.query-branches.v1';
const COLLECTION_COLORS = ['#d8a985', '#7ab9a5', '#7699d7', '#b99ac8', '#c5a459', '#789095'];
function safeParse(key) {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function safeWrite(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        // Storage is an enhancement; the current session remains fully usable if blocked.
    }
}
function isTerm(value) {
    if (!value || typeof value !== 'object')
        return false;
    const term = value;
    return typeof term.id === 'string'
        && ['text', 'artwork', 'image', 'detail'].includes(term.kind ?? '')
        && (term.polarity === 'positive' || term.polarity === 'negative')
        && typeof term.label === 'string'
        && Array.isArray(term.vector)
        && term.vector.length === EMBEDDING_DIMENSIONS.length
        && term.vector.every((value) => typeof value === 'number' && Number.isFinite(value))
        && Math.abs(Math.hypot(...term.vector) - 1) <= 1e-3
        && ((term.kind !== 'image' && term.kind !== 'detail') || Math.hypot(...term.vector.slice(SEMANTIC_VECTOR_LENGTH)) > 1e-8)
        && (term.kind !== 'detail' || Boolean(term.crop && [term.crop.x, term.crop.y, term.crop.width, term.crop.height].every(Number.isFinite)
            && term.crop.x >= 0 && term.crop.y >= 0 && term.crop.width > 0 && term.crop.height > 0
            && term.crop.x + term.crop.width <= 1 && term.crop.y + term.crop.height <= 1))
        && typeof term.weight === 'number' && Number.isFinite(term.weight) && term.weight > 0;
}
function isFilter(value) {
    if (!value || typeof value !== 'object')
        return false;
    const filter = value;
    const usableValue = typeof filter.value === 'number' ? Number.isFinite(filter.value)
        : typeof filter.value === 'string' && filter.value.trim().length > 0;
    const usableDate = filter.field !== 'before' && filter.field !== 'after'
        || (usableValue && Number.isFinite(Number(filter.value)));
    return typeof filter.id === 'string'
        && ['cluster', 'culture', 'department', 'medium', 'classification', 'before', 'after'].includes(filter.field ?? '')
        && typeof filter.label === 'string'
        && usableValue && usableDate;
}
export function loadCollections(knownIds) {
    const value = safeParse(COLLECTIONS_KEY);
    if (!Array.isArray(value))
        return [];
    return value
        .filter((candidate) => {
        if (!candidate || typeof candidate !== 'object')
            return false;
        const collection = candidate;
        return typeof collection.id === 'string'
            && typeof collection.name === 'string'
            && Array.isArray(collection.artworkIds)
            && typeof collection.createdAt === 'number';
    })
        .map((collection, index) => ({
        ...collection,
        artworkIds: collection.artworkIds.filter((id) => typeof id === 'string' && knownIds.has(id)).slice(0, 5000),
        color: collection.color || COLLECTION_COLORS[index % COLLECTION_COLORS.length]
    }))
        .filter((collection) => collection.artworkIds.length > 0)
        .slice(0, 16);
}
export function saveCollections(collections) {
    safeWrite(COLLECTIONS_KEY, collections.slice(0, 16));
}
export function collectionColor(index) {
    return COLLECTION_COLORS[index % COLLECTION_COLORS.length];
}
export function loadBranches(knownIds, key = BRANCHES_KEY) {
    const value = safeParse(key);
    if (!Array.isArray(value))
        return [];
    return value
        .filter((candidate) => {
        if (!candidate || typeof candidate !== 'object')
            return false;
        const branch = candidate;
        return typeof branch.id === 'string'
            && typeof branch.name === 'string'
            && Array.isArray(branch.terms)
            && branch.terms.every(isTerm)
            && Array.isArray(branch.filters)
            && branch.filters.every(isFilter)
            && typeof branch.createdAt === 'number';
    })
        .map((branch) => ({
        ...branch,
        terms: branch.terms.filter((term) => !term.artworkId || knownIds.has(term.artworkId)).slice(0, 10),
        filters: branch.filters.slice(0, 8)
    }))
        .filter((branch) => branch.terms.some((term) => term.polarity === 'positive'))
        .slice(0, 12);
}
export function saveBranches(branches) {
    safeWrite(BRANCHES_KEY, branches.slice(0, 12));
}
const TEXT_BRANCHES_KEY = 'needle.text-query-branches.v1';
export function loadTextBranches(knownIds) {
    const candidates = [...loadBranches(knownIds, TEXT_BRANCHES_KEY), ...loadBranches(knownIds)];
    const seen = new Set();
    return candidates.filter(branch => {
        if (seen.has(branch.id) || !branch.terms.every(term => term.kind === 'text' && term.polarity === 'positive'))
            return false;
        seen.add(branch.id);
        return true;
    }).slice(0, 12);
}
export function saveTextBranches(branches) {
    safeWrite(TEXT_BRANCHES_KEY, branches.slice(0, 12));
}
//# sourceMappingURL=workspace-storage.js.map