import { normalizeVector } from '../../vector-engine/src/distance.js';
export function composeWeightedQuery(vectors, dimensions) {
    if (!Number.isInteger(dimensions) || dimensions < 1)
        throw new Error('Query composition requires a positive vector dimension.');
    if (vectors.length === 0)
        throw new Error('Query composition requires at least one vector.');
    const combined = new Float32Array(dimensions);
    let positiveWeight = 0;
    let firstPositive = null;
    for (const term of vectors) {
        if (term.vector.length !== dimensions) {
            throw new Error(`Query vector has ${term.vector.length} dimensions; expected ${dimensions}.`);
        }
        if (!Number.isFinite(term.weight) || Array.from(term.vector).some((value) => !Number.isFinite(value))) {
            throw new Error('Query evidence and weights must contain finite numbers.');
        }
        if (vectorMagnitude(term.vector) < 1e-8)
            throw new Error('Query evidence must have a nonzero vector.');
        const magnitude = Math.max(0.01, Math.min(4, term.weight));
        const direction = term.polarity === 'negative' ? -1 : 1;
        if (direction > 0) {
            positiveWeight += magnitude;
            firstPositive ??= term.vector;
        }
        for (let index = 0; index < dimensions; index += 1) {
            combined[index] = (combined[index] ?? 0) + (term.vector[index] ?? 0) * magnitude * direction;
        }
    }
    if (positiveWeight === 0 || vectorMagnitude(combined) < 1e-8) {
        if (!firstPositive)
            throw new Error('A query needs at least one positive term.');
        return normalizeVector(Float32Array.from(firstPositive));
    }
    return normalizeVector(combined);
}
function vectorMagnitude(vector) {
    let sum = 0;
    for (let index = 0; index < vector.length; index += 1)
        sum += (vector[index] ?? 0) ** 2;
    return Math.sqrt(sum);
}
//# sourceMappingURL=query-composer.js.map