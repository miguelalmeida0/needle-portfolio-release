import { normalizeVector } from '../../vector-engine/src/distance.js';
import { fnv1a } from './hash.js';
import { RESIDUAL_DIMENSIONS, SEMANTIC_DIMENSIONS, SEMANTIC_VECTOR_LENGTH } from './embedding-schema.js';
import { PHRASE_RULES, SEMANTIC_LEXICON } from './semantic-lexicon.js';
import { tokenize } from './tokenize.js';
export class ArtSemanticEncoder {
    #dimensionIndex = new Map(SEMANTIC_DIMENSIONS.map((dimension, index) => [dimension, index]));
    #termToDimensions = new Map();
    constructor() {
        for (const [dimension, terms] of Object.entries(SEMANTIC_LEXICON)) {
            for (const term of [dimension, ...terms]) {
                const normalized = term.toLowerCase();
                const existing = this.#termToDimensions.get(normalized) ?? [];
                this.#termToDimensions.set(normalized, [...existing, dimension]);
            }
        }
    }
    encodeText(text) {
        return this.#encode([{ text, weight: 1 }]);
    }
    encodeArtwork(artwork) {
        const tagText = artwork.tags.join(' ');
        return this.#encode([
            { text: artwork.title, weight: 2.8 },
            { text: tagText, weight: 2.2 },
            { text: artwork.objectName, weight: 1.4 },
            { text: artwork.classification, weight: 1.25 },
            { text: artwork.medium, weight: 1.15 },
            { text: artwork.department, weight: .9 },
            { text: `${artwork.culture} ${artwork.period}`, weight: .9 },
            { text: artwork.creator, weight: .45 },
            { text: artwork.objectDate, weight: .25 }
        ]);
    }
    #encode(fields) {
        const vector = new Float32Array(SEMANTIC_VECTOR_LENGTH);
        let tokenCount = 0;
        for (const field of fields) {
            if (!field.text.trim())
                continue;
            const normalizedText = field.text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
            for (const [phrase, rules] of Object.entries(PHRASE_RULES)) {
                if (!normalizedText.includes(phrase))
                    continue;
                for (const [dimension, score] of rules)
                    this.#addDimension(vector, dimension, score * field.weight);
            }
            const tokens = tokenize(normalizedText);
            tokenCount += tokens.length;
            for (const token of tokens) {
                const dimensions = this.#termToDimensions.get(token) ?? [];
                for (const dimension of dimensions)
                    this.#addDimension(vector, dimension, field.weight);
                this.#addResidual(vector, token, field.weight * (dimensions.length ? .035 : .11));
            }
            for (let index = 0; index < tokens.length - 1; index += 1) {
                const phrase = `${tokens[index]} ${tokens[index + 1]}`;
                const dimensions = this.#termToDimensions.get(phrase) ?? [];
                for (const dimension of dimensions)
                    this.#addDimension(vector, dimension, field.weight * 1.25);
            }
        }
        if (tokenCount === 0)
            vector[0] = 1;
        return normalizeVector(vector);
    }
    #addDimension(vector, dimension, amount) {
        const index = this.#dimensionIndex.get(dimension);
        if (index !== undefined)
            vector[index] = (vector[index] ?? 0) + amount;
    }
    #addResidual(vector, token, amount) {
        const hash = fnv1a(token);
        const residualIndex = SEMANTIC_DIMENSIONS.length + (hash % RESIDUAL_DIMENSIONS.length);
        const polarity = (hash & 1) === 0 ? 1 : -1;
        vector[residualIndex] = (vector[residualIndex] ?? 0) + amount * polarity;
    }
}
//# sourceMappingURL=art-semantic-encoder.js.map