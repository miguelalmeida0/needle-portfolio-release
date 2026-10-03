import { SEMANTIC_DIMENSIONS, SEMANTIC_VECTOR_LENGTH } from './embedding-schema.js';
const LABEL_OVERRIDES = {
    human: 'human figure',
    face: 'facial subject',
    group: 'group composition',
    armor: 'armor and protection',
    weapon: 'weapons',
    royal: 'royal imagery',
    landscape: 'landscape subject',
    field: 'open fields',
    water: 'water',
    sacred: 'sacred subject',
    myth: 'mythic subject',
    object: 'decorative object',
    vessel: 'vessel form',
    jewelry: 'jewelry',
    textile: 'textile pattern',
    sculpture: 'sculptural form',
    geometric: 'geometric structure',
    monochrome: 'monochrome palette',
    dramatic: 'dramatic mood',
    strange: 'unusual subject',
    ancient: 'ancient period',
    medieval: 'medieval period',
    renaissance: 'Renaissance period',
    asian: 'Asian art context',
    african: 'African art context',
    european: 'European art context',
    american: 'American art context'
};
export function explainVectorMatch(query, candidate, limit = 4) {
    const evidence = [];
    for (let index = 0; index < SEMANTIC_DIMENSIONS.length; index += 1) {
        const contribution = Math.max(0, (query[index] ?? 0) * (candidate[index] ?? 0));
        if (contribution <= 1e-5)
            continue;
        const dimension = SEMANTIC_DIMENSIONS[index] ?? '';
        evidence.push({
            id: dimension,
            label: LABEL_OVERRIDES[dimension] ?? dimension.replace(/-/g, ' '),
            strength: contribution,
            kind: 'subject'
        });
    }
    const visualGroups = [
        ['palette', 'similar color palette', 0, 12],
        ['light', 'similar light and dark balance', 12, 16],
        ['edges', 'similar line direction', 16, 20],
        ['composition', 'similar spatial composition', 20, 32]
    ];
    for (const [id, label, start, end] of visualGroups) {
        let contribution = 0;
        for (let offset = start; offset < end; offset += 1) {
            const index = SEMANTIC_VECTOR_LENGTH + offset;
            contribution += Math.max(0, (query[index] ?? 0) * (candidate[index] ?? 0));
        }
        if (contribution > 1e-5)
            evidence.push({ id: `visual:${id}`, label, strength: contribution, kind: 'visual' });
    }
    const ranked = evidence.sort((left, right) => right.strength - left.strength).slice(0, Math.max(1, limit));
    const peak = ranked[0]?.strength ?? 1;
    return ranked.map((item) => ({ ...item, strength: Math.min(1, item.strength / peak) }));
}
//# sourceMappingURL=match-explanation.js.map