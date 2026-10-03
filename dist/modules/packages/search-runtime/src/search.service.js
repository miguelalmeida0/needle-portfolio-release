import { LocalSearchEngine, toSearchDocument } from './local-search-engine.js';
import { SearchCache, searchCacheKey } from './search-cache.js';
const workerUrl = () => new URL(typeof __NEEDLE_SEARCH_WORKER_URL__ === 'undefined' ? './search.worker.js' : __NEEDLE_SEARCH_WORKER_URL__, import.meta.url);
export class SearchService {
    #worker = null;
    #fallback = null;
    #pending = new Map();
    #readyPromise = Promise.resolve();
    #cache = new SearchCache();
    #cancelInitialization = null;
    loadCorpus(url, onProgress) {
        this.dispose();
        return new Promise((resolve, reject) => {
            this.#cancelInitialization = () => reject(new Error('Search service disposed.'));
            let corpus = null;
            const worker = new Worker(workerUrl(), { type: 'module', name: 'needle-search' });
            this.#worker = worker;
            const fail = (message) => {
                worker.terminate();
                this.#worker = null;
                this.#cancelInitialization = null;
                for (const pending of this.#pending.values())
                    pending.reject(new Error(message));
                this.#pending.clear();
                reject(new Error(message));
            };
            worker.onerror = event => fail(event.message || 'Search worker failed to initialize. Reload to retry.');
            const listener = (event) => {
                if (event.data.type === 'corpus')
                    corpus = event.data.corpus;
                else if (event.data.type === 'progress')
                    onProgress(event.data.completed, event.data.total);
                else if (event.data.type === 'ready' && corpus) {
                    worker.removeEventListener('message', listener);
                    worker.addEventListener('message', this.#handleMessage);
                    this.#cancelInitialization = null;
                    resolve(corpus);
                }
                else if (event.data.type === 'error')
                    fail(event.data.message);
            };
            worker.addEventListener('message', listener);
            worker.postMessage({ type: 'load-corpus', url });
        });
    }
    initialize(items, onProgress = () => undefined) {
        this.dispose();
        if (typeof Worker === 'undefined') {
            this.#fallback = new LocalSearchEngine(items);
            onProgress(items.length, items.length);
            this.#readyPromise = Promise.resolve();
            return this.#readyPromise;
        }
        this.#readyPromise = new Promise((resolve, reject) => {
            this.#cancelInitialization = () => reject(new Error('Search service disposed.'));
            const ready = () => { this.#cancelInitialization = null; resolve(); };
            try {
                const worker = new Worker(workerUrl(), { type: 'module', name: 'needle-search' });
                this.#worker = worker;
                worker.onerror = () => {
                    if (this.#worker !== worker)
                        return;
                    worker.terminate();
                    this.#worker = null;
                    for (const pending of this.#pending.values())
                        pending.reject(new Error('Search worker failed. Retry the search.'));
                    this.#pending.clear();
                    this.#fallback = new LocalSearchEngine(items);
                    onProgress(items.length, items.length);
                    ready();
                };
                const listener = (event) => {
                    if (this.#worker !== worker)
                        return;
                    if (event.data.type === 'progress') {
                        onProgress(event.data.completed, event.data.total);
                    }
                    else if (event.data.type === 'ready') {
                        worker.removeEventListener('message', listener);
                        worker.addEventListener('message', this.#handleMessage);
                        ready();
                    }
                    else if (event.data.type === 'error') {
                        worker.removeEventListener('message', listener);
                        worker.terminate();
                        this.#worker = null;
                        this.#fallback = new LocalSearchEngine(items);
                        onProgress(items.length, items.length);
                        ready();
                    }
                };
                worker.addEventListener('message', listener);
                const dimensions = items[0]?.vector.length ?? 0;
                const vectors = new Float32Array(items.length * dimensions);
                const ids = new Array(items.length);
                for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
                    const item = items[itemIndex];
                    if (!item)
                        continue;
                    ids[itemIndex] = item.id;
                    vectors.set(item.vector, itemIndex * dimensions);
                }
                const documents = items.map(toSearchDocument);
                worker.postMessage({ type: 'initialize', ids, dimensions, vectors, documents }, [vectors.buffer]);
            }
            catch {
                this.#worker = null;
                this.#fallback = new LocalSearchEngine(items);
                onProgress(items.length, items.length);
                ready();
            }
        });
        return this.#readyPromise;
    }
    async search(request) {
        await this.#readyPromise;
        const key = searchCacheKey(request);
        const cached = this.#cache.get(key);
        if (cached)
            return cached;
        if (this.#fallback) {
            const response = this.#fallback.search(request);
            this.#cache.set(key, response);
            return response;
        }
        if (!this.#worker)
            throw new Error('Search engine is unavailable.');
        const response = await new Promise((resolve, reject) => {
            this.#pending.set(request.requestId, { resolve, reject });
            this.#worker?.postMessage({ type: 'search', payload: request });
        });
        this.#cache.set(key, response);
        return response;
    }
    dispose() {
        this.#cancelInitialization?.();
        this.#cancelInitialization = null;
        this.#cache.clear();
        this.#worker?.removeEventListener('message', this.#handleMessage);
        this.#worker?.terminate();
        this.#worker = null;
        this.#fallback = null;
        for (const pending of this.#pending.values())
            pending.reject(new Error('Search service disposed.'));
        this.#pending.clear();
    }
    #handleMessage = (event) => {
        if (event.data.type === 'result') {
            const pending = this.#pending.get(event.data.requestId);
            if (!pending)
                return;
            this.#pending.delete(event.data.requestId);
            pending.resolve(event.data.payload);
        }
        else if (event.data.type === 'error' && event.data.requestId) {
            const pending = this.#pending.get(event.data.requestId);
            if (!pending)
                return;
            this.#pending.delete(event.data.requestId);
            pending.reject(new Error(event.data.message));
        }
    };
}
//# sourceMappingURL=search.service.js.map