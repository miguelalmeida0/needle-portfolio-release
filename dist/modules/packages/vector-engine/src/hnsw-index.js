import { dotProduct, magnitude, normalizeVector } from './distance.js';
import { PriorityQueue } from './priority-queue.js';
import { DeterministicRandom } from './random.js';
export class HnswIndex {
    #dimensions;
    #maxConnections;
    #efConstruction;
    #random;
    #nodes = [];
    #entryPointIndex = null;
    #maxLevel = -1;
    #norms = new WeakMap();
    #distance(left, right) {
        let leftNorm = this.#norms.get(left);
        let rightNorm = this.#norms.get(right);
        if (leftNorm === undefined) {
            leftNorm = magnitude(left);
            this.#norms.set(left, leftNorm);
        }
        if (rightNorm === undefined) {
            rightNorm = magnitude(right);
            this.#norms.set(right, rightNorm);
        }
        const denominator = leftNorm * rightNorm;
        return denominator === 0 ? 1 : 1 - dotProduct(left, right) / denominator;
    }
    constructor(options) {
        this.#dimensions = options.dimensions;
        this.#maxConnections = options.maxConnections ?? 8;
        this.#efConstruction = options.efConstruction ?? 48;
        this.#random = new DeterministicRandom(options.seed ?? 0x1eafcafe);
    }
    get size() {
        return this.#nodes.length;
    }
    snapshot() {
        return { version: 1, dimensions: this.#dimensions, entryPoint: this.#entryPointIndex, maxLevel: this.#maxLevel,
            nodes: this.#nodes.map(node => ({ id: node.id, level: node.level, neighbors: node.neighbors.map(layer => [...layer]) })) };
    }
    restore(snapshot, entries) {
        if (this.size || snapshot.version !== 1 || snapshot.dimensions !== this.#dimensions || snapshot.nodes.length !== entries.length
            || !Number.isInteger(snapshot.maxLevel) || snapshot.maxLevel < -1 || snapshot.maxLevel > 8
            || (entries.length > 0 && (!Number.isInteger(snapshot.entryPoint) || snapshot.entryPoint < 0 || snapshot.entryPoint >= entries.length)))
            throw new Error('Invalid HNSW snapshot');
        const nodes = snapshot.nodes.map((node, index) => {
            const entry = entries[index];
            if (node.id !== entry.id || entry.vector.length !== this.#dimensions || !Number.isInteger(node.level) || node.level < 0 || node.level > 8
                || node.neighbors.length !== node.level + 1 || node.neighbors.some(layer => !Array.isArray(layer) || layer.some(neighbor => !Number.isInteger(neighbor) || neighbor < 0 || neighbor >= entries.length)))
                throw new Error('Invalid HNSW snapshot node');
            return { id: node.id, vector: normalizeVector(entry.vector), level: node.level, neighbors: node.neighbors.map(layer => [...layer]) };
        });
        for (const node of nodes)
            this.#nodes.push(node);
        this.#entryPointIndex = snapshot.entryPoint;
        this.#maxLevel = snapshot.maxLevel;
    }
    add(id, inputVector) {
        if (inputVector.length !== this.#dimensions) {
            throw new Error(`Expected ${this.#dimensions} dimensions, received ${inputVector.length}`);
        }
        const vector = normalizeVector(inputVector);
        const level = this.#randomLevel();
        const nodeIndex = this.#nodes.length;
        const node = {
            id,
            vector,
            level,
            neighbors: Array.from({ length: level + 1 }, () => [])
        };
        this.#nodes.push(node);
        if (this.#entryPointIndex === null) {
            this.#entryPointIndex = nodeIndex;
            this.#maxLevel = level;
            return;
        }
        let current = this.#entryPointIndex;
        for (let currentLevel = this.#maxLevel; currentLevel > level; currentLevel -= 1) {
            current = this.#greedyAtLevel(vector, current, currentLevel).nodeIndex;
        }
        const highestSharedLevel = Math.min(level, this.#maxLevel);
        for (let currentLevel = highestSharedLevel; currentLevel >= 0; currentLevel -= 1) {
            const candidates = this.#searchLayer(vector, [current], this.#efConstruction, currentLevel).results;
            const connectionLimit = currentLevel === 0 ? this.#maxConnections * 2 : this.#maxConnections;
            const selected = candidates.slice(0, connectionLimit);
            for (const candidate of selected)
                this.#connect(nodeIndex, candidate.nodeIndex, currentLevel, connectionLimit);
            current = selected[0]?.nodeIndex ?? current;
        }
        if (level > this.#maxLevel) {
            this.#entryPointIndex = nodeIndex;
            this.#maxLevel = level;
        }
    }
    search(queryInput, k, efSearch) {
        const startedAt = performance.now();
        if (this.#entryPointIndex === null || this.#nodes.length === 0) {
            return {
                hits: [],
                trace: { entryPointId: null, visitedIds: [], edges: [], distanceCalculations: 0, layersTraversed: 0 },
                elapsedMs: performance.now() - startedAt,
                inspectedRatio: 0
            };
        }
        const query = normalizeVector(queryInput);
        const visitedOrder = [];
        const tracedEdges = [];
        let calculations = 0;
        let current = this.#entryPointIndex;
        for (let level = this.#maxLevel; level > 0; level -= 1) {
            const greedy = this.#greedyAtLevel(query, current, level, visitedOrder, tracedEdges);
            current = greedy.nodeIndex;
            calculations += greedy.calculations;
        }
        const layer = this.#searchLayer(query, [current], Math.max(k, efSearch), 0, visitedOrder, tracedEdges);
        calculations += layer.calculations;
        const hits = layer.results.slice(0, k).map((candidate, index) => ({
            id: this.#nodes[candidate.nodeIndex]?.id ?? '',
            distance: candidate.distance,
            rank: index + 1
        })).filter((hit) => hit.id.length > 0);
        const uniqueVisited = [...new Set(visitedOrder)].map((index) => this.#nodes[index]?.id).filter((id) => Boolean(id));
        const edges = tracedEdges.slice(0, 480).map((edge) => ({
            fromId: this.#nodes[edge.fromIndex]?.id ?? '',
            toId: this.#nodes[edge.toIndex]?.id ?? '',
            level: edge.level,
            accepted: edge.accepted,
            phase: edge.phase
        })).filter((edge) => edge.fromId && edge.toId);
        return {
            hits,
            trace: {
                entryPointId: this.#nodes[this.#entryPointIndex]?.id ?? null,
                visitedIds: uniqueVisited,
                edges,
                distanceCalculations: calculations,
                layersTraversed: this.#maxLevel + 1
            },
            elapsedMs: performance.now() - startedAt,
            inspectedRatio: this.#nodes.length === 0 ? 0 : uniqueVisited.length / this.#nodes.length
        };
    }
    #randomLevel() {
        let level = 0;
        while (level < 8 && this.#random.next() < 1 / Math.E)
            level += 1;
        return level;
    }
    #greedyAtLevel(query, startIndex, level, visitedOrder, trace) {
        let currentIndex = startIndex;
        let currentDistance = this.#distance(query, this.#nodes[currentIndex]?.vector ?? []);
        let calculations = 1;
        visitedOrder?.push(currentIndex);
        let improved = true;
        while (improved) {
            improved = false;
            const originIndex = currentIndex;
            const neighbors = this.#nodes[originIndex]?.neighbors[level] ?? [];
            for (const neighborIndex of neighbors) {
                const neighbor = this.#nodes[neighborIndex];
                if (!neighbor)
                    continue;
                const distance = this.#distance(query, neighbor.vector);
                calculations += 1;
                visitedOrder?.push(neighborIndex);
                const accepted = distance < currentDistance;
                trace?.push({ fromIndex: originIndex, toIndex: neighborIndex, level, accepted, phase: 'greedy' });
                if (accepted) {
                    currentDistance = distance;
                    currentIndex = neighborIndex;
                    improved = true;
                }
            }
        }
        return { nodeIndex: currentIndex, distance: currentDistance, calculations };
    }
    #searchLayer(query, entryPoints, ef, level, visitedOrder, trace) {
        const candidates = new PriorityQueue((left, right) => left.distance - right.distance);
        const best = new PriorityQueue((left, right) => right.distance - left.distance);
        const visited = new Set();
        let calculations = 0;
        for (const entryPoint of entryPoints) {
            const node = this.#nodes[entryPoint];
            if (!node)
                continue;
            const candidate = { nodeIndex: entryPoint, distance: this.#distance(query, node.vector) };
            calculations += 1;
            visited.add(entryPoint);
            visitedOrder?.push(entryPoint);
            candidates.push(candidate);
            best.push(candidate);
        }
        while (candidates.size > 0) {
            const current = candidates.pop();
            if (!current)
                break;
            const worst = best.peek();
            if (worst && best.size >= ef && current.distance > worst.distance)
                break;
            const neighbors = this.#nodes[current.nodeIndex]?.neighbors[level] ?? [];
            for (const neighborIndex of neighbors) {
                if (visited.has(neighborIndex))
                    continue;
                visited.add(neighborIndex);
                visitedOrder?.push(neighborIndex);
                const neighbor = this.#nodes[neighborIndex];
                if (!neighbor)
                    continue;
                const distance = this.#distance(query, neighbor.vector);
                calculations += 1;
                const candidate = { nodeIndex: neighborIndex, distance };
                const currentWorst = best.peek();
                const accepted = best.size < ef || !currentWorst || distance < currentWorst.distance;
                trace?.push({ fromIndex: current.nodeIndex, toIndex: neighborIndex, level, accepted, phase: 'candidate' });
                if (accepted) {
                    candidates.push(candidate);
                    best.push(candidate);
                    if (best.size > ef)
                        best.pop();
                }
            }
        }
        return {
            results: best.toArray().sort((left, right) => left.distance - right.distance),
            calculations
        };
    }
    #connect(leftIndex, rightIndex, level, limit) {
        if (leftIndex === rightIndex)
            return;
        const left = this.#nodes[leftIndex];
        const right = this.#nodes[rightIndex];
        if (!left || !right || left.level < level || right.level < level)
            return;
        if (!left.neighbors[level]?.includes(rightIndex))
            left.neighbors[level]?.push(rightIndex);
        if (!right.neighbors[level]?.includes(leftIndex))
            right.neighbors[level]?.push(leftIndex);
        this.#prune(leftIndex, level, limit);
        this.#prune(rightIndex, level, limit);
    }
    #prune(nodeIndex, level, limit) {
        const node = this.#nodes[nodeIndex];
        const neighbors = node?.neighbors[level];
        if (!node || !neighbors || neighbors.length <= limit)
            return;
        // Each immutable pair is evaluated once, rather than twice per sort comparison.
        const distances = new Map(neighbors.map(index => [index, this.#distance(node.vector, this.#nodes[index].vector)]));
        neighbors.sort((leftIndex, rightIndex) => distances.get(leftIndex) - distances.get(rightIndex));
        neighbors.splice(limit);
    }
}
//# sourceMappingURL=hnsw-index.js.map