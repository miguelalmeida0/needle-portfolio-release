const FIELD_WEIGHTS = {
    title: 5.4,
    tags: 3.5,
    objectName: 2.65,
    classification: 2.15,
    medium: 1.75,
    creator: 1.05,
    culture: .95,
    period: .85,
    department: .55
};
const QUERY_EXPANSIONS = {
    coffee: ['coffeepot', 'coffee-pot', 'cafe', 'cup', 'beverage', 'drink', 'vessel'],
    tea: ['teapot', 'teacup', 'cup', 'beverage', 'drink', 'vessel'],
    dog: ['dogs', 'hound', 'canine', 'spaniel', 'puppy'],
    cat: ['cats', 'feline', 'kitten', 'lion', 'tiger', 'leopard'],
    armor: ['armour', 'helmet', 'mail', 'breastplate', 'shield'],
    storm: ['stormy', 'tempest', 'thunder', 'cloud', 'sky'],
    calm: ['quiet', 'serene', 'peaceful', 'still'],
    portrait: ['face', 'head', 'figure', 'sitter'],
    flower: ['flowers', 'floral', 'bouquet', 'bloom', 'petal'],
    gold: ['golden', 'gilt', 'gilded', 'brass'],
    door: ['doors', 'doorway', 'portal', 'frame', 'panel'],
    cup: ['coffee', 'tea', 'vessel', 'beaker', 'bowl']
};
export class LexicalIndex {
    #documents;
    #postings = new Map();
    #documentFrequencies = new Map();
    #normalizedTitles;
    constructor(documents) {
        this.#documents = documents;
        this.#normalizedTitles = documents.map((document) => normalizeText(document.title));
        for (const [documentIndex, document] of documents.entries()) {
            const weights = documentTokenWeights(document);
            for (const [token, weight] of weights) {
                const postings = this.#postings.get(token) ?? [];
                postings.push({ documentIndex, weight });
                this.#postings.set(token, postings);
                this.#documentFrequencies.set(token, (this.#documentFrequencies.get(token) ?? 0) + 1);
            }
        }
    }
    search(query, limit) {
        const normalizedQuery = normalizeText(query);
        const queryTokens = expandedQueryTokens(normalizedQuery);
        if (queryTokens.length === 0 || this.#documents.length === 0)
            return [];
        const scores = new Map();
        for (const { token, weight: queryWeight } of queryTokens) {
            const postings = this.#postings.get(token);
            if (!postings)
                continue;
            const documentFrequency = this.#documentFrequencies.get(token) ?? 0;
            const inverseDocumentFrequency = Math.log((this.#documents.length + 1) / (documentFrequency + .5)) + 1;
            for (const posting of postings) {
                scores.set(posting.documentIndex, (scores.get(posting.documentIndex) ?? 0) + posting.weight * inverseDocumentFrequency * queryWeight);
            }
        }
        if (normalizedQuery.length >= 3) {
            for (const [documentIndex, title] of this.#normalizedTitles.entries()) {
                if (title === normalizedQuery)
                    scores.set(documentIndex, (scores.get(documentIndex) ?? 0) + 22);
                else if (title.includes(normalizedQuery))
                    scores.set(documentIndex, (scores.get(documentIndex) ?? 0) + 10);
            }
        }
        const ordered = [...scores.entries()]
            .sort((left, right) => right[1] - left[1] || left[0] - right[0])
            .slice(0, Math.max(1, limit));
        const maximum = ordered[0]?.[1] ?? 1;
        return ordered.map(([documentIndex, score]) => ({
            id: this.#documents[documentIndex]?.id ?? '',
            score: maximum > 0 ? Math.min(1, score / maximum) : 0
        })).filter((hit) => Boolean(hit.id));
    }
}
function documentTokenWeights(document) {
    const result = new Map();
    const add = (text, fieldWeight) => {
        const tokens = tokenize(text);
        for (const token of tokens) {
            result.set(token, Math.max(result.get(token) ?? 0, fieldWeight));
        }
        for (let index = 0; index < tokens.length - 1; index += 1) {
            const phrase = `${tokens[index]}_${tokens[index + 1]}`;
            result.set(phrase, Math.max(result.get(phrase) ?? 0, fieldWeight * 1.28));
        }
    };
    add(document.title, FIELD_WEIGHTS.title);
    add(document.tags.join(' '), FIELD_WEIGHTS.tags);
    add(document.objectName, FIELD_WEIGHTS.objectName);
    add(document.classification, FIELD_WEIGHTS.classification);
    add(document.medium, FIELD_WEIGHTS.medium);
    add(document.creator, FIELD_WEIGHTS.creator);
    add(document.culture, FIELD_WEIGHTS.culture);
    add(document.period, FIELD_WEIGHTS.period);
    add(document.department, FIELD_WEIGHTS.department);
    return result;
}
function expandedQueryTokens(query) {
    const base = tokenize(query);
    const tokens = new Map();
    const add = (token, weight) => tokens.set(token, Math.max(tokens.get(token) ?? 0, weight));
    for (const token of base) {
        add(token, 1);
        for (const expansion of QUERY_EXPANSIONS[token] ?? []) {
            for (const normalized of tokenize(expansion))
                add(normalized, .46);
        }
    }
    for (let index = 0; index < base.length - 1; index += 1)
        add(`${base[index]}_${base[index + 1]}`, 1.3);
    return [...tokens.entries()].map(([token, weight]) => ({ token, weight }));
}
export function tokenize(input) {
    const raw = normalizeText(input).match(/[a-z0-9]+/g) ?? [];
    const output = [];
    for (const token of raw) {
        if (token.length < 2)
            continue;
        output.push(token);
        const stem = lightStem(token);
        if (stem !== token && stem.length >= 3)
            output.push(stem);
    }
    return [...new Set(output)];
}
function lightStem(token) {
    if (token.length > 5 && token.endsWith('ies'))
        return `${token.slice(0, -3)}y`;
    if (token.length > 5 && token.endsWith('ing'))
        return token.slice(0, -3);
    if (token.length > 4 && token.endsWith('es'))
        return token.slice(0, -2);
    if (token.length > 3 && token.endsWith('s'))
        return token.slice(0, -1);
    return token;
}
function normalizeText(value) {
    return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
//# sourceMappingURL=lexical-index.js.map