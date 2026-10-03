export function dotProduct(left, right) {
    if (left.length !== right.length)
        throw new Error(`Vector length mismatch: ${left.length} !== ${right.length}`);
    let total = 0;
    for (let index = 0; index < left.length; index += 1) {
        total += (left[index] ?? 0) * (right[index] ?? 0);
    }
    return total;
}
export function magnitude(vector) {
    return Math.sqrt(dotProduct(vector, vector));
}
export function normalizeVector(vector) {
    const norm = magnitude(vector) || 1;
    return Float32Array.from(vector, (value) => value / norm);
}
export function cosineDistance(left, right) {
    const denominator = magnitude(left) * magnitude(right);
    if (denominator === 0)
        return 1;
    return 1 - dotProduct(left, right) / denominator;
}
//# sourceMappingURL=distance.js.map