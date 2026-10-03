import { normalizeVector } from '../../vector-engine/src/distance.js';
import { ArtSemanticEncoder } from './art-semantic-encoder.js';
import { EMBEDDING_DIMENSIONS, SEMANTIC_VECTOR_LENGTH, VISUAL_VECTOR_LENGTH } from './embedding-schema.js';
import { describeImageFile, describeImageUrl } from './visual-descriptor.js';
export class ArtEmbeddingSpace {
    #semantic = new ArtSemanticEncoder();
    dimensions = EMBEDDING_DIMENSIONS;
    encodeText(text) {
        return combineSegments(this.#semantic.encodeText(text), new Float32Array(VISUAL_VECTOR_LENGTH), 1, 0);
    }
    encodeArtwork(artwork, visual) {
        return combineSegments(this.#semantic.encodeArtwork(artwork), visual ?? new Float32Array(VISUAL_VECTOR_LENGTH), visual ? .82 : 1, visual ? .57 : 0);
    }
    async encodeImage(file) {
        const visual = await describeImageFile(file);
        return combineSegments(new Float32Array(SEMANTIC_VECTOR_LENGTH), visual, 0, 1);
    }
    describeArtworkImage(url) {
        return describeImageUrl(url);
    }
}
function combineSegments(semantic, visual, semanticWeight, visualWeight) {
    const combined = new Float32Array(SEMANTIC_VECTOR_LENGTH + VISUAL_VECTOR_LENGTH);
    for (let index = 0; index < SEMANTIC_VECTOR_LENGTH; index += 1) {
        combined[index] = (semantic[index] ?? 0) * semanticWeight;
    }
    for (let index = 0; index < VISUAL_VECTOR_LENGTH; index += 1) {
        combined[SEMANTIC_VECTOR_LENGTH + index] = (visual[index] ?? 0) * visualWeight;
    }
    return normalizeVector(combined);
}
//# sourceMappingURL=art-embedding-space.js.map