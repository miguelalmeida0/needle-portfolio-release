export class BrowserCorpusRepository {
    #url;
    checksum = '';
    constructor(url = '/data/corpus.json') {
        this.#url = url;
    }
    async load() {
        const response = await fetch(this.#url, { cache: 'no-cache' });
        if (!response.ok)
            throw new Error(`Corpus request failed with ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (globalThis.crypto?.subtle)
            this.checksum = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
        const corpus = JSON.parse(new TextDecoder().decode(bytes));
        validateCorpus(corpus);
        return corpus;
    }
}
export function validateCorpus(corpus) {
    if (corpus.schemaVersion !== 2)
        throw new Error(`Unsupported corpus schema ${corpus.schemaVersion}`);
    if (corpus.source?.id !== 'met-open-access')
        throw new Error('Corpus is not a Met Open Access snapshot.');
    if (!Array.isArray(corpus.items) || corpus.items.length < 3)
        throw new Error('Corpus contains too few artworks.');
    if (corpus.embedding.semanticDimensions + corpus.embedding.visualDimensions !== corpus.dimensions.length) {
        throw new Error('Embedding descriptor does not match the declared dimensions.');
    }
    const ids = new Set();
    for (const item of corpus.items) {
        if (ids.has(item.id))
            throw new Error(`Duplicate artwork id ${item.id}.`);
        ids.add(item.id);
        if (!item.objectId || !item.objectUrl || !item.title || !item.imageUrl) {
            throw new Error(`Artwork ${item.id} is missing required Met metadata.`);
        }
        if (item.vector.length !== 0 && item.vector.length !== corpus.dimensions.length) {
            throw new Error(`Vector ${item.id} has ${item.vector.length} dimensions; expected zero or ${corpus.dimensions.length}.`);
        }
        if (corpus.source.mode === 'met-snapshot') {
            const thumbnail = item.thumbnailUrl ?? item.imageUrl;
            const detail = item.detailImageUrl ?? item.imageUrl;
            if (!thumbnail.startsWith('/assets/met/') || !detail.startsWith('/assets/met/')) {
                throw new Error(`Artwork ${item.id} does not use local snapshot assets.`);
            }
        }
        if (corpus.source.mode === 'met-pack') {
            const prefix = `/packs/${corpus.source.packId}/images/`;
            const thumbnail = item.thumbnailUrl ?? item.imageUrl;
            const detail = item.detailImageUrl ?? item.imageUrl;
            if (!corpus.source.packId || !thumbnail.startsWith(prefix) || !detail.startsWith(prefix)) {
                throw new Error(`Artwork ${item.id} does not use the active local pack.`);
            }
            if (!item.imageOptimized)
                throw new Error(`Artwork ${item.id} was not validated by the pack builder.`);
        }
        if (corpus.source.mode === 'met-hybrid-pack') {
            const prefix = `/packs/${corpus.source.packId}/images/`;
            const thumbnail = item.thumbnailUrl ?? item.imageUrl;
            const detail = item.detailImageUrl ?? item.imageUrl;
            if (!corpus.source.packId)
                throw new Error('Hybrid pack is missing a pack id.');
            if (item.previewRank) {
                if (!thumbnail.startsWith(prefix) || !item.imageOptimized) {
                    throw new Error(`Opening preview ${item.id} is not a verified local pack image.`);
                }
            }
            else {
                if (!/^https?:\/\//.test(thumbnail) || item.imageOptimized) {
                    throw new Error(`Lazy artwork ${item.id} does not use an official remote image URL.`);
                }
            }
            if (!detail.startsWith(prefix) && !/^https?:\/\//.test(detail)) {
                throw new Error(`Artwork ${item.id} has no valid detail image source.`);
            }
        }
    }
    if (corpus.source.mode === 'met-static') {
        if (corpus.source.assetMode !== 'verified-preload')
            throw new Error('Static corpus is not configured for verified image preloading.');
        if ((corpus.source.requiredImageCount ?? corpus.source.imageCount) < 8)
            throw new Error('Static corpus requires too few artwork images.');
        if ((corpus.source.candidateCount ?? corpus.items.length) < (corpus.source.requiredImageCount ?? corpus.source.imageCount)) {
            throw new Error('Static corpus has fewer candidates than required images.');
        }
    }
    if (corpus.source.mode === 'met-snapshot' && corpus.source.assetMode !== 'local-optimized') {
        throw new Error('The active Met snapshot is not marked as locally optimized.');
    }
    if (corpus.source.mode === 'met-pack') {
        if (corpus.source.assetMode !== 'local-pack')
            throw new Error('The active Met pack is not local.');
        if (corpus.source.imageCount !== corpus.items.length)
            throw new Error('The Met pack is missing image-backed records.');
        if ((corpus.source.previewImageCount ?? 0) < 1)
            throw new Error('The Met pack declares no map previews.');
    }
    if (corpus.source.mode === 'met-hybrid-pack') {
        if (corpus.source.assetMode !== 'local-preview-remote-detail')
            throw new Error('The hybrid Met pack has the wrong asset mode.');
        const previews = corpus.items.filter((item) => Boolean(item.previewRank));
        if (previews.length < 1 || previews.length !== corpus.source.previewImageCount || previews.length !== corpus.source.imageCount) {
            throw new Error('The hybrid Met pack preview counts are inconsistent.');
        }
    }
}
//# sourceMappingURL=corpus.repository.js.map