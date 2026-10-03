export const SEMANTIC_DIMENSIONS = [
    'animal', 'cat', 'dog', 'horse', 'bird', 'fish', 'insect',
    'human', 'portrait', 'face', 'woman', 'man', 'child', 'family', 'group', 'gesture', 'fashion',
    'armor', 'weapon', 'military', 'royal',
    'landscape', 'mountain', 'field', 'forest', 'tree', 'flower', 'garden', 'water', 'sea', 'river', 'sky', 'moon', 'sun', 'night', 'snow', 'storm',
    'architecture', 'city', 'building', 'interior', 'ruin',
    'sacred', 'myth', 'death', 'love', 'music', 'dance',
    'object', 'vessel', 'jewelry', 'gold', 'textile', 'pattern', 'sculpture', 'ceramic', 'glass', 'metal', 'wood', 'paper',
    'ink', 'oil', 'watercolor', 'print', 'photograph',
    'abstract', 'geometric', 'minimal', 'monochrome', 'vivid', 'warm', 'cool', 'red', 'blue', 'green', 'black', 'white', 'texture', 'line', 'light', 'dark',
    'calm', 'dramatic', 'strange', 'ancient', 'medieval', 'renaissance', 'modern', 'asian', 'african', 'european', 'american'
];
export const RESIDUAL_DIMENSIONS = Array.from({ length: 24 }, (_, index) => `residual:${index}`);
export const VISUAL_DIMENSIONS = [
    ...Array.from({ length: 8 }, (_, index) => `visual:hue:${index}`),
    ...Array.from({ length: 4 }, (_, index) => `visual:saturation:${index}`),
    ...Array.from({ length: 4 }, (_, index) => `visual:luminance:${index}`),
    ...Array.from({ length: 4 }, (_, index) => `visual:edge:${index}`),
    ...Array.from({ length: 12 }, (_, index) => `visual:grid:${index}`)
];
export const EMBEDDING_DIMENSIONS = [
    ...SEMANTIC_DIMENSIONS,
    ...RESIDUAL_DIMENSIONS,
    ...VISUAL_DIMENSIONS
];
export const SEMANTIC_VECTOR_LENGTH = SEMANTIC_DIMENSIONS.length + RESIDUAL_DIMENSIONS.length;
export const VISUAL_VECTOR_LENGTH = VISUAL_DIMENSIONS.length;
//# sourceMappingURL=embedding-schema.js.map