const EDGE_GUTTER = 16;
const LABEL_HEIGHT = 24;
const COLLISION_GAP = 9;
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}
function estimateLabelWidth(label) {
    // 8px uppercase labels with tracking, dot, gap and horizontal padding.
    return clamp(30 + label.length * 5.15, 82, 170);
}
function rectAt(x, y, width, height) {
    return {
        left: x - width / 2,
        top: y - height / 2,
        right: x + width / 2,
        bottom: y + height / 2
    };
}
function inflate(rect, amount) {
    return {
        left: rect.left - amount,
        top: rect.top - amount,
        right: rect.right + amount,
        bottom: rect.bottom + amount
    };
}
function intersects(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function normalizeDirection(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
}
function reservedRects(options) {
    const rects = [];
    const { width, height } = options;
    // The truth lens is a separate overlay at the top-center of the map. Reserving it
    // here prevents semantic labels from ever reading through that control.
    const truthWidth = Math.min(620, Math.max(360, width - 42));
    rects.push(inflate(rectAt(width / 2, 42, truthWidth, 58), 5));
    // Result nodes are meaningful interaction targets; labels must route around them.
    for (const coordinate of options.resultCoordinates) {
        rects.push(inflate(rectAt(coordinate.x * width, coordinate.y * height, 66, 66), COLLISION_GAP));
    }
    if (options.featuredMatch) {
        const cardWidth = width < 1180 ? 156 : 176;
        const cardHeight = width < 1180 ? 242 : 276;
        rects.push(inflate(rectAt(width * .5, height * .48 + 18, cardWidth, cardHeight), 40));
    }
    else if (options.queryNode) {
        rects.push(inflate(rectAt(width * .5, height * .48, 116, 116), 18));
    }
    // Permanent map controls at bottom-left.
    rects.push(inflate({ left: 14, top: height - 180, right: 76, bottom: height - 8 }, 5));
    return rects;
}
function candidatePositions(base, mapCenter, labelWidth, obstacles) {
    const outward = normalizeDirection(base.x - mapCenter.x, base.y - mapCenter.y);
    const tangent = { x: -outward.y, y: outward.x };
    const candidates = [base];
    // Preserve the original location when possible, then move radially away from the
    // central result. Tangential options prevent two neighboring labels from stacking.
    for (const distance of [24, 42, 64, 88, 116, 148]) {
        candidates.push({ x: base.x + outward.x * distance, y: base.y + outward.y * distance });
        if (distance >= 42) {
            const tangentDistance = Math.min(56, distance * .55);
            candidates.push({
                x: base.x + outward.x * distance + tangent.x * tangentDistance,
                y: base.y + outward.y * distance + tangent.y * tangentDistance
            });
            candidates.push({
                x: base.x + outward.x * distance - tangent.x * tangentDistance,
                y: base.y + outward.y * distance - tangent.y * tangentDistance
            });
        }
    }
    // Obstacle edge lanes are the precision move. When a label begins inside the truth
    // lens, featured card, or a ranked result, offer the nearest clean side rather than
    // throwing the label far across the map.
    const baseRect = rectAt(base.x, base.y, labelWidth, LABEL_HEIGHT);
    const halfWidth = labelWidth / 2;
    const halfHeight = LABEL_HEIGHT / 2;
    for (const obstacle of obstacles) {
        if (!intersects(baseRect, obstacle))
            continue;
        candidates.push({ x: obstacle.left - halfWidth - COLLISION_GAP, y: base.y }, { x: obstacle.right + halfWidth + COLLISION_GAP, y: base.y }, { x: base.x, y: obstacle.top - halfHeight - COLLISION_GAP }, { x: base.x, y: obstacle.bottom + halfHeight + COLLISION_GAP }, { x: obstacle.left - halfWidth - COLLISION_GAP, y: obstacle.bottom + halfHeight + COLLISION_GAP }, { x: obstacle.right + halfWidth + COLLISION_GAP, y: obstacle.bottom + halfHeight + COLLISION_GAP });
    }
    return candidates;
}
function collisionCount(rect, obstacles) {
    return obstacles.reduce((count, obstacle) => count + (intersects(rect, obstacle) ? 1 : 0), 0);
}
export function layoutClusterLabels(clusters, options) {
    const width = Math.max(1, options.width);
    const height = Math.max(1, options.height);
    const obstacles = reservedRects({ ...options, width, height });
    const occupied = [];
    const mapCenter = { x: width * .5, y: height * .48 };
    // Place labels closest to the featured result first. Those are the ones most likely
    // to collide and therefore deserve the strongest continuity with their cluster.
    const ordered = [...clusters].sort((a, b) => {
        const ad = Math.hypot(a.center.x - .5, a.center.y - .48);
        const bd = Math.hypot(b.center.x - .5, b.center.y - .48);
        return ad - bd;
    });
    const positions = new Map();
    for (const cluster of ordered) {
        const labelWidth = estimateLabelWidth(cluster.label);
        const halfWidth = labelWidth / 2;
        const halfHeight = LABEL_HEIGHT / 2;
        const base = {
            x: cluster.center.x * width,
            y: (cluster.center.y - .11) * height
        };
        const candidates = candidatePositions(base, mapCenter, labelWidth, obstacles);
        let best = null;
        let bestRect = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const raw of candidates) {
            const candidate = {
                x: clamp(raw.x, EDGE_GUTTER + halfWidth, width - EDGE_GUTTER - halfWidth),
                y: clamp(raw.y, EDGE_GUTTER + halfHeight, height - EDGE_GUTTER - halfHeight)
            };
            const rect = rectAt(candidate.x, candidate.y, labelWidth, LABEL_HEIGHT);
            const hardCollisions = collisionCount(rect, obstacles);
            const labelCollisions = collisionCount(inflate(rect, 4), occupied);
            const displacement = Math.hypot(candidate.x - base.x, candidate.y - base.y);
            const centerDistance = Math.hypot(candidate.x - mapCenter.x, candidate.y - mapCenter.y);
            const baseCenterDistance = Math.hypot(base.x - mapCenter.x, base.y - mapCenter.y);
            const inwardPenalty = Math.max(0, baseCenterDistance - centerDistance) * 2.4;
            const score = hardCollisions * 100_000 + labelCollisions * 50_000 + displacement + inwardPenalty;
            if (score < bestScore) {
                best = candidate;
                bestRect = rect;
                bestScore = score;
            }
            if (hardCollisions === 0 && labelCollisions === 0 && displacement < 1)
                break;
        }
        if (!best || !bestRect)
            continue;
        occupied.push(inflate(bestRect, COLLISION_GAP));
        positions.set(cluster.id, { id: cluster.id, x: best.x / width, y: best.y / height });
    }
    return clusters.map((cluster) => positions.get(cluster.id) ?? {
        id: cluster.id,
        x: cluster.center.x,
        y: clamp(cluster.center.y - .11, .04, .96)
    });
}
//# sourceMappingURL=cluster-label-layout.js.map