import { HybridSearchEngine as LegacyHybridSearchEngine } from '../../dist/modules/packages/search-runtime/src/hybrid-search-engine.js';
import { cosineDistance } from '../../dist/modules/packages/vector-engine/src/distance.js';
import { RelevanceIndex } from './relevance-index.mjs';

// Versioned text retrieval. Preserve the graph/encoder and the image/mixed-query
// path; require catalogue evidence before any text candidate can be ranked.
export class HybridSearchEngine extends LegacyHybridSearchEngine {
  #relevance;
  #vectors;
  constructor(entries, documents, onProgress, snapshot) {
    super(entries, documents, onProgress, snapshot);
    this.#relevance = new RelevanceIndex(documents);
    this.#vectors = new Map(entries.map(entry => [entry.id, entry.vector]));
  }
  search(request) {
    if (request.queryKind !== 'text' || !request.queryText?.trim()) return super.search(request);
    const start = performance.now();
    const { candidates } = this.#relevance.search(request.queryText, request.filters);
    const base = candidates.length ? super.search(request) : null;
    const query = Float32Array.from(request.vector);
    const hits = candidates.map(candidate => {
      const semantic = Math.max(0, Math.min(1, 1 - cosineDistance(query, this.#vectors.get(candidate.id))));
      return { id: candidate.id, score: candidate.evidence * .9 + semantic * .1 };
    }).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id))
      .slice(0, Math.max(1, request.k)).map((hit, index) => ({ id: hit.id, rank: index+1, distance: 1-hit.score }));
    const visited = [...new Set([...(base?.trace.visitedIds ?? []), ...candidates.map(candidate => candidate.id)])];
    return {
      hits,
      trace: { entryPointId: base?.trace.entryPointId ?? null, visitedIds: visited, edges: base?.trace.edges ?? [],
        distanceCalculations: (base?.trace.distanceCalculations ?? 0) + candidates.length, layersTraversed: base?.trace.layersTraversed ?? 0 },
      elapsedMs: Math.max(.01, performance.now()-start),
      inspectedRatio: visited.length / Math.max(1, this.#vectors.size),
      relevance: { version: 'catalogue-v2', matchedCount: candidates.length, status: hits.length ? 'matched' : 'no-match' },
    };
  }
}
