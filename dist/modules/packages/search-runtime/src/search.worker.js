import { HybridSearchEngine } from './hybrid-search-engine.js';
import { BrowserCorpusRepository } from '../../museum-corpus/src/corpus.repository.js';
import { ArtEmbeddingSpace } from '../../query-encoder/src/art-embedding-space.js';
import { toSearchDocument } from './local-search-engine.js';
let engine = null;
function post(message) {
    self.postMessage(message);
}
function initialize(ids, dimensions, vectors, documents) {
    if (dimensions < 1 || vectors.length !== ids.length * dimensions || documents.length !== ids.length) {
        throw new Error(`Invalid worker index payload: ${ids.length} ids, ${documents.length} documents, ${vectors.length} values, ${dimensions} dimensions.`);
    }
    const entries = ids.map((id, entryIndex) => ({
        id,
        vector: vectors.subarray(entryIndex * dimensions, (entryIndex + 1) * dimensions)
    }));
    engine = new HybridSearchEngine(entries, documents, (completed, total) => post({ type: 'progress', completed, total }));
    post({ type: 'ready', itemCount: entries.length });
}
function search(payload) {
    if (!engine)
        throw new Error('Search worker has not been initialized.');
    const response = engine.search(payload);
    post({ type: 'result', requestId: payload.requestId, payload: response });
}
self.onmessage = async (event) => {
    try {
        if (event.data.type === 'load-corpus') {
            const repository = new BrowserCorpusRepository(event.data.url);
            const graphPromise = fetch('/data/search-graph.json').then(response => response.ok ? response.json() : null).catch(() => null);
            const raw = await repository.load();
            const space = new ArtEmbeddingSpace();
            const corpus = { ...raw, dimensions: space.dimensions, items: raw.items.map(item => ({
                    ...item, vector: [...space.encodeArtwork(item, item.visualVector?.length === raw.embedding.visualDimensions ? item.visualVector : undefined)]
                })) };
            post({ type: 'corpus', corpus });
            const entries = corpus.items.map(item => ({ id: item.id, vector: Float32Array.from(item.vector) }));
            const documents = corpus.items.map(toSearchDocument);
            const progress = (completed, total) => post({ type: 'progress', completed, total });
            const graph = await graphPromise;
            try {
                engine = new HybridSearchEngine(entries, documents, progress, graph?.corpusSha256 === repository.checksum && graph?.encoderVersion === 1 ? graph.snapshot : undefined);
            }
            catch {
                engine = new HybridSearchEngine(entries, documents, progress);
            }
            post({ type: 'ready', itemCount: corpus.items.length });
        }
        else if (event.data.type === 'initialize')
            initialize(event.data.ids, event.data.dimensions, event.data.vectors, event.data.documents);
        else
            search(event.data.payload);
    }
    catch (error) {
        const requestId = event.data.type === 'search' ? event.data.payload.requestId : null;
        post({ type: 'error', requestId, message: error instanceof Error ? error.message : String(error) });
    }
};
//# sourceMappingURL=search.worker.js.map