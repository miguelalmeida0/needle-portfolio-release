const stopwords = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'in', 'on', 'at', 'to', 'for']);
function words(text) {
    return (text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter(word => !stopwords.has(word)).map(word => word.length > 3 && /s$/.test(word) && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word);
}
function subjectTitle(title) {
    return title.split(/,\s*from\b|\s+for\b(?=.*\b(?:cigarettes?|tobacco|brand)\b)/i)[0] ?? '';
}
function family(artwork) {
    const name = (artwork.objectName ?? '').toLowerCase();
    const classification = (artwork.classification ?? '').toLowerCase();
    const combined = `${name} ${classification}`;
    for (const [pattern, label] of [[/netsuke/, 'netsuke'], [/amulet/, 'amulet']])
        if (pattern.test(combined))
            return label;
    for (const label of ['drawing', 'print', 'painting', 'photograph'])
        if (new RegExp(`\\b${label}s?\\b`).test(name))
            return label;
    for (const [pattern, label] of [[/ceramic|pottery|porcelain/, 'ceramic'], [/sculpture/, 'sculpture'], [/textile|tapestr/, 'textile'], [/\b(jar|vase|bowl|bottle)s?\b/, 'vessel'], [/book/, 'book'], [/frame/, 'frame'], [/drawing/, 'drawing'], [/painting/, 'painting'], [/photograph/, 'photograph'], [/print/, 'print']])
        if (pattern.test(combined))
            return label;
    return null;
}
export function catalogueDate(artwork) { return artwork.objectDate || 'Date not recorded'; }
/** A conservative view of returned hits, never a second retrieval system. */
export function selectDiscovery(input) {
    const positive = input.positive.map(words);
    if (!positive.length || positive.some(tokens => !tokens.length))
        return [];
    const negative = input.negative.map(words).filter(tokens => tokens.length);
    const seen = new Set();
    const eligible = [];
    for (const hit of input.hits) {
        if (seen.has(hit.id))
            continue;
        seen.add(hit.id);
        const artwork = input.record(hit.id);
        if (!artwork || artwork.id !== `met-${artwork.objectId}` || !artwork.title || !/^https:\/\/(?:www\.)?metmuseum\.org\//.test(artwork.objectUrl) || !(artwork.thumbnailUrl || artwork.imageUrl || artwork.detailImageUrl) || !input.accepts(artwork))
            continue;
        const text = subjectTitle(artwork.title);
        const tokens = new Set(words(text));
        if (!positive.every(query => query.every(word => tokens.has(word))) || negative.some(query => query.every(word => tokens.has(word))))
            continue;
        eligible.push({ artwork, evidence: { field: 'title', text }, family: family(artwork) });
    }
    const selected = new Set();
    const families = new Set();
    for (const item of eligible)
        if (item.family && !families.has(item.family) && selected.size < 6) {
            selected.add(item);
            families.add(item.family);
        }
    for (const item of eligible)
        if (selected.size < 6)
            selected.add(item);
    return eligible.filter(item => selected.has(item));
}
//# sourceMappingURL=select.js.map