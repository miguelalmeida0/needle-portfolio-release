import { explainVectorMatch } from '../../../../packages/query-encoder/src/match-explanation.js';
import { ArtEmbeddingSpace } from '../../../../packages/query-encoder/src/art-embedding-space.js';
import { SEMANTIC_VECTOR_LENGTH } from '../../../../packages/query-encoder/src/embedding-schema.js';
import { calculateRecall } from '../shared/utils/recall.js';
const itemIndexes = new WeakMap();
const evidenceSpace = new ArtEmbeddingSpace();
export function maximumSearchBudget(state) {
    const corpusSize = state.queryTerms.some((term) => term.kind === 'image' || term.kind === 'detail')
        ? Math.max(24, state.visualIndexProgress.completed)
        : state.corpus?.items.length ?? 72;
    return Math.max(24, Math.min(corpusSize, corpusSize >= 50_000 ? 4096 : corpusSize >= 10_000 ? 2048 : corpusSize));
}
export function effectiveSearchBudget(state) {
    return Math.min(state.efSearch, maximumSearchBudget(state));
}
export function artworkById(state, id) {
    if (!id)
        return null;
    const items = state.corpus?.items;
    if (!items)
        return null;
    let index = itemIndexes.get(items);
    if (!index) {
        index = new Map(items.map(item => [item.id, item]));
        itemIndexes.set(items, index);
    }
    return index.get(id) ?? null;
}
export function selectedArtwork(state) {
    return artworkById(state, state.selectedArtworkId);
}
export function queryArtwork(state) {
    return artworkById(state, state.queryArtworkId);
}
export function queryScopeDescription(state) {
    const corpus = state.corpus;
    if (!corpus)
        return 'Preparing the catalog.';
    const total = corpus.items.length;
    const pack = corpus.source.mode === 'met-pack' || corpus.source.mode === 'met-hybrid-pack';
    const ready = state.indexPhase === 'hybrid';
    const coverage = ready ? state.visualIndexProgress.completed : pack ? Math.min(total, corpus.source.previewImageCount ?? 72, 72) : total;
    if (state.queryTerms.some((term) => term.kind === 'image' || term.kind === 'detail')) {
        return `This recipe searches ${coverage.toLocaleString()} of ${total.toLocaleString()} artworks with visual descriptors. Limited visual matches may not match the described subject.`;
    }
    return `${total.toLocaleString()} catalog records. Image/detail search: ${ready ? '' : 'up to '}${coverage.toLocaleString()} opening artworks.`;
}
export function queryResultLabel(state) {
    return state.queryTerms.some((term) => term.kind === 'image' || term.kind === 'detail') ? 'Closest available' : 'Best match';
}
export function visibleHits(state) {
    return state.resultMode === 'truth' && state.exact ? state.exact.hits : state.approximate?.hits ?? [];
}
export function featuredTextMatch(state) {
    if (state.queryKind !== 'text')
        return null;
    const firstHit = visibleHits(state)[0];
    return firstHit ? artworkById(state, firstHit.id) : null;
}
export function selectedHit(state) {
    if (!state.selectedArtworkId)
        return null;
    return visibleHits(state).find((hit) => hit.id === state.selectedArtworkId) ?? null;
}
export function selectedMatchEvidence(state) {
    const artwork = selectedArtwork(state);
    if (!artwork || !state.queryVector || artwork.id === state.queryArtworkId)
        return [];
    const recipe = recipeEvidence(state, artwork);
    const lexical = state.queryKind === 'text' ? lexicalEvidence(state.activeQuery, artwork) : [];
    const visualRecipe = state.queryTerms.some((term) => term.kind === 'image' || term.kind === 'detail');
    const candidate = visualRecipe && artwork.visualVector ? evidenceSpace.encodeArtwork(artwork, artwork.visualVector) : artwork.vector;
    const vector = explainVectorMatch(state.queryVector, candidate, Math.max(1, 4 - recipe.length - lexical.length));
    return [...recipe, ...lexical, ...vector].slice(0, 5);
}
function recipeEvidence(state, artwork) {
    const evidence = [];
    const positiveReference = state.queryTerms.find((term) => term.polarity === 'positive' && (term.kind === 'artwork' || term.kind === 'image'));
    const detail = state.queryTerms.find((term) => term.polarity === 'positive' && term.kind === 'detail');
    const negative = state.queryTerms.find((term) => term.polarity === 'negative');
    for (const [id, term] of [['reference', positiveReference], ['detail', detail]]) {
        if (!term)
            continue;
        if (term.kind === 'artwork') {
            evidence.push({ id: `recipe:${id}`, label: 'Artwork metadata reference applied', strength: vectorAgreement(term.vector, artwork.vector), kind: 'subject' });
        }
        else if (artwork.visualVector) {
            const strength = vectorAgreement(term.vector.slice(SEMANTIC_VECTOR_LENGTH), artwork.visualVector);
            evidence.push({ id: `recipe:${id}`, label: `${term.kind === 'detail' ? 'Detail' : 'Reference'} color, light and composition: ${Math.round(strength * 100)}% descriptor agreement`, strength, kind: 'visual' });
        }
    }
    if (negative) {
        const visual = negative.kind === 'image' || negative.kind === 'detail';
        if (!visual || artwork.visualVector) {
            const agreement = visual ? vectorAgreement(negative.vector.slice(SEMANTIC_VECTOR_LENGTH), artwork.visualVector) : vectorAgreement(negative.vector, artwork.vector);
            evidence.push({ id: 'recipe:negative', label: `${visual ? 'Visual' : 'Metadata'} exclusion applied: ${stripPrefix(negative.label)}`, strength: 1 - agreement, kind: visual ? 'visual' : 'subject' });
        }
    }
    if (state.queryFilters.length > 0 && matchesQueryFilters(artwork, state.queryFilters)) {
        evidence.push({ id: 'recipe:filters', label: `Filters: ${state.queryFilters.slice(0, 3).map((filter) => filter.label).join(', ')}`, strength: .82, kind: 'subject' });
    }
    return evidence;
}
function vectorAgreement(left, right) {
    const norm = Math.hypot(...left) * Math.hypot(...right);
    if (norm < 1e-8)
        return 0;
    return Math.max(0, Math.min(1, left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0) / norm));
}
function lexicalEvidence(query, artwork) {
    const queryTokens = tokens(query);
    if (queryTokens.length === 0)
        return [];
    const fields = [
        ['title', artwork.title, 1],
        ['subject', artwork.tags.join(' '), .92],
        ['object type', artwork.objectName, .84],
        ['medium', artwork.medium, .72],
        ['classification', artwork.classification, .68]
    ];
    const evidence = [];
    for (const [label, value, strength] of fields) {
        const fieldTokens = new Set(tokens(value));
        const matches = queryTokens.filter((token) => fieldTokens.has(token));
        if (matches.length === 0)
            continue;
        evidence.push({
            id: `lexical:${label}`,
            label: `${label}: ${matches.slice(0, 2).join(', ')}`,
            strength,
            kind: 'subject'
        });
        if (evidence.length >= 2)
            break;
    }
    return evidence;
}
function tokens(value) {
    return [...new Set((value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 1))];
}
function stripPrefix(value) {
    return value.replace(/^[^:]+:\s*/, '');
}
export function selectedSimilarity(state) {
    const hit = selectedHit(state);
    return hit ? Math.max(0, Math.min(1, 1 - hit.distance)) : null;
}
export function recall(state) {
    if (!state.approximate || !state.exact)
        return null;
    return calculateRecall(state.approximate.hits, state.exact.hits);
}
export function missedExactIds(state) {
    if (!state.approximate || !state.exact)
        return new Set();
    const approximateIds = new Set(state.approximate.hits.map((hit) => hit.id));
    return new Set(state.exact.hits.filter((hit) => !approximateIds.has(hit.id)).map((hit) => hit.id));
}
export function activeCollection(state) {
    if (!state.scopedCollectionId)
        return null;
    return state.savedCollections.find((collection) => collection.id === state.scopedCollectionId) ?? null;
}
export function scopedCorpusItems(state) {
    const collection = activeCollection(state);
    if (!collection)
        return state.corpus?.items ?? [];
    const ids = new Set(collection.artworkIds);
    return (state.corpus?.items ?? []).filter((item) => ids.has(item.id));
}
export function compareArtworks(state) {
    return state.compareArtworkIds.map((id) => artworkById(state, id)).filter((item) => Boolean(item));
}
export function detailSearchArtwork(state) {
    return artworkById(state, state.detailSearchArtworkId);
}
export function matchesQueryFilters(artwork, filters) {
    return filters.every((filter) => {
        if (filter.field === 'cluster')
            return artwork.clusterId === String(filter.value);
        if (filter.field === 'culture')
            return includesNormalized(artwork.culture, String(filter.value));
        if (filter.field === 'department')
            return includesNormalized(artwork.department, String(filter.value));
        if (filter.field === 'medium')
            return includesNormalized(artwork.medium, String(filter.value));
        if (filter.field === 'classification')
            return includesNormalized(artwork.classification, String(filter.value));
        if (filter.field === 'before')
            return artwork.year !== null && artwork.year < Number(filter.value);
        if (filter.field === 'after')
            return artwork.year !== null && artwork.year > Number(filter.value);
        return true;
    });
}
function includesNormalized(value, expected) {
    const left = value.trim().toLowerCase();
    const right = expected.trim().toLowerCase();
    if (!left || !right)
        return false;
    return left === right || left.includes(right);
}
//# sourceMappingURL=app.selectors.js.map