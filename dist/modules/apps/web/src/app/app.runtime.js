import { ArtEmbeddingSpace } from '../../../../packages/query-encoder/src/art-embedding-space.js';
import { composeWeightedQuery } from '../../../../packages/query-encoder/src/query-composer.js';
import { VisualIndexEnricher } from '../../../../packages/query-encoder/src/visual-index-enricher.js';
import { RecallProbeService } from '../../../../packages/search-runtime/src/recall-probe.service.js';
import { SearchService } from '../../../../packages/search-runtime/src/search.service.js';
import { BrowserCorpusRepository } from '../../../../packages/museum-corpus/src/corpus.repository.js';
import { effectiveSearchBudget } from './app.selectors.js';
import { loadHistory, saveHistory } from '../shared/utils/history.js';
import { createRequestId } from '../shared/utils/id.js';
import { loadVisualCache, saveVisualCache } from '../shared/utils/visual-cache.js';
import { collectionColor, loadBranches, loadTextBranches, loadCollections, saveBranches, saveTextBranches, saveCollections } from '../shared/utils/workspace-storage.js';
import { AppStore } from './app.store.js';
import { TRUTH_CHALLENGE_PROMPTS } from './truth-challenge.queries.js';
export class AppRuntime {
    #experimentalVisual;
    get experimentalVisual() { return this.#experimentalVisual; }
    constructor(options = {}) {
        this.#experimentalVisual = options.experimentalVisual === true;
    }
    store = new AppStore();
    #searchService = new SearchService();
    #visualSearchService = new SearchService();
    #corpusRepository = new BrowserCorpusRepository();
    #embeddingSpace = new ArtEmbeddingSpace();
    #recallProbe = new RecallProbeService(this.#searchService);
    #activeSearchSequence = 0;
    #recipeIntent = 0;
    #metadataArtworkVectors = new Map();
    #tuningTimer = null;
    #feedbackTimer = null;
    #visualReadyPromise = null;
    #releaseCorpusImages = null;
    #pendingDraft = false;
    #visualUsesMainIndex = false;
    #disposed = false;
    async start() {
        try {
            const corpus = await this.#loadSearchCorpus();
            if (this.#disposed)
                return;
            const hasPrecomputedVisuals = corpus.items.every((item) => item.visualVector?.length === corpus.embedding.visualDimensions);
            this.#metadataArtworkVectors = new Map(corpus.items.map((item) => [item.id, item.vector]));
            this.#visualUsesMainIndex = hasPrecomputedVisuals;
            const knownIds = new Set(corpus.items.map((item) => item.id));
            const savedHistory = loadHistory().filter((entry) => knownIds.has(entry.artworkId));
            const history = savedHistory.length > 0 ? savedHistory : this.#seedHistory(corpus);
            const collections = loadCollections(knownIds);
            const branches = this.experimentalVisual ? loadBranches(knownIds) : loadTextBranches(knownIds);
            const draft = this.store.getSnapshot().draftQuery;
            this.store.dispatch({ type: 'BOOTSTRAP_READY', corpus, history, collections, branches });
            if (draft)
                this.setDraft(draft);
            if (hasPrecomputedVisuals)
                this.store.dispatch({ type: 'VISUAL_INDEX_READY', corpus });
            await this.searchText(this.#pendingDraft && draft ? draft : corpus.defaultQuery.text, false, false, true);
            if (draft && !this.#pendingDraft)
                this.setDraft(draft);
            this.#visualReadyPromise = hasPrecomputedVisuals ? Promise.resolve() : null;
        }
        catch (error) {
            if (this.#disposed)
                return;
            this.store.dispatch({ type: 'BOOTSTRAP_FAILED', message: error instanceof Error ? error.message : String(error) });
        }
    }
    setDraft(value) {
        this.#recipeIntent++;
        this.store.dispatch({ type: 'DRAFT_CHANGED', value });
    }
    setMapView(view) {
        this.store.dispatch({ type: 'MAP_VIEW_CHANGED', view });
    }
    async submitDraft() {
        const state = this.store.getSnapshot();
        if (!state.corpus) {
            this.#pendingDraft = true;
            return;
        }
        const query = state.draftQuery.trim();
        if (!query)
            return;
        const textTerm = this.#textTerm(query);
        const terms = [textTerm, ...state.queryTerms.filter((term) => term.kind !== 'text')].slice(0, 10);
        await this.#executeRecipe(terms, state.queryFilters, { addToHistory: true, focusResults: false, activeBranchId: null });
    }
    async searchText(text, addToHistory = true, focusResults = false, resetRecipe = true) {
        const state = this.store.getSnapshot();
        const terms = resetRecipe
            ? [this.#textTerm(text)]
            : [this.#textTerm(text), ...state.queryTerms.filter((term) => term.kind !== 'text')].slice(0, 10);
        const filters = resetRecipe ? [] : state.queryFilters;
        if (resetRecipe)
            this.store.dispatch({ type: 'COLLECTION_SCOPE_CHANGED', collectionId: null });
        await this.#executeRecipe(terms, filters, { addToHistory, focusResults, activeBranchId: null });
    }
    async searchArtwork(artworkId) {
        if (!this.experimentalVisual)
            return;
        const artwork = this.#artwork(artworkId);
        if (!artwork)
            return;
        const term = this.#artworkTerm(artwork, 'positive', true, 1);
        this.store.dispatch({ type: 'COLLECTION_SCOPE_CHANGED', collectionId: null });
        await this.#executeRecipe([term], [], { addToHistory: true, focusResults: true, activeBranchId: null });
    }
    async searchUpload(file) {
        if (!this.experimentalVisual)
            return;
        const intent = this.#beginRecipeIntent();
        const label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Uploaded reference';
        try {
            await this.#ensureVisualIndex();
            if (!this.#isCurrentIntent(intent))
                return;
            const [vector, previewUrl] = await Promise.all([
                this.#embeddingSpace.encodeImage(file),
                readAsDataUrl(file)
            ]);
            if (!this.#isCurrentIntent(intent))
                return;
            const term = {
                id: createRequestId('image-term'),
                kind: 'image',
                polarity: 'positive',
                label,
                vector: [...vector],
                weight: .85,
                previewUrl
            };
            const state = this.store.getSnapshot();
            const terms = [...state.queryTerms.filter((candidate) => candidate.kind !== 'image' || candidate.previewUrl !== previewUrl), term].slice(-10);
            if (await this.#executeRecipe(terms, state.queryFilters, { intent, addToHistory: true, focusResults: true, activeBranchId: null })) {
                this.#feedback('Reference image added to the query');
            }
        }
        catch (error) {
            if (!this.#isCurrentIntent(intent))
                return;
            this.store.dispatch({ type: 'SEARCH_FAILED', message: error instanceof Error ? error.message : String(error) });
        }
    }
    async addDetailReference(preparation, artworkId, crop, previewUrl = '') {
        if (!this.experimentalVisual) {
            void Promise.resolve(preparation).catch(() => { });
            return;
        }
        const intent = this.#beginRecipeIntent();
        const artwork = this.#artwork(artworkId);
        if (!artwork)
            return;
        try {
            const prepared = await preparation;
            if (!this.#isCurrentIntent(intent))
                return;
            const blob = prepared instanceof Blob ? prepared : prepared?.blob;
            if (!blob)
                throw new Error('The selected detail could not be cropped. Try again with an available artwork image.');
            if (!(prepared instanceof Blob))
                previewUrl = prepared.previewUrl;
            await this.#ensureVisualIndex();
            if (!this.#isCurrentIntent(intent))
                return;
            const vector = await this.#embeddingSpace.encodeImage(blob);
            if (!this.#isCurrentIntent(intent))
                return;
            const term = {
                id: createRequestId('detail-term'),
                kind: 'detail',
                polarity: 'positive',
                label: `Detail from ${shortTitle(artwork.title)}`,
                vector: [...vector],
                weight: .78,
                artworkId,
                previewUrl,
                crop
            };
            const state = this.store.getSnapshot();
            const terms = [...state.queryTerms, term].slice(-10);
            this.store.dispatch({ type: 'DETAIL_SEARCH_CHANGED', artworkId: null });
            if (await this.#executeRecipe(terms, state.queryFilters, { intent, addToHistory: true, focusResults: false, activeBranchId: null })) {
                this.#feedback('Selected detail added to the query');
            }
        }
        catch (error) {
            if (!this.#isCurrentIntent(intent))
                return;
            this.store.dispatch({ type: 'SEARCH_FAILED', message: error instanceof Error ? error.message : String(error) });
        }
    }
    openDetailSearch(artworkId) {
        if (!this.experimentalVisual)
            return;
        if (!this.#artwork(artworkId))
            return;
        this.#recipeIntent++;
        this.store.dispatch({ type: 'DETAIL_SEARCH_CHANGED', artworkId });
    }
    closeDetailSearch() {
        this.#recipeIntent++;
        this.store.dispatch({ type: 'DETAIL_SEARCH_CHANGED', artworkId: null });
    }
    async moreLike(artworkId) {
        await this.#addArtworkReference(artworkId, 'positive', false, .8, 'Reference');
    }
    async lessLike(artworkId) {
        await this.#addArtworkReference(artworkId, 'negative', false, .65, 'Less like');
    }
    async pinToQuery(artworkId) {
        await this.#addArtworkReference(artworkId, 'positive', true, 1.1, 'Pinned reference');
    }
    async removeQueryTerm(termId) {
        const state = this.store.getSnapshot();
        let terms = state.queryTerms.filter((term) => term.id !== termId);
        if (!terms.some((term) => term.polarity === 'positive')) {
            const fallback = state.draftQuery.trim();
            terms = fallback ? [this.#textTerm(fallback)] : [];
        }
        if (terms.length === 0)
            return;
        await this.#executeRecipe(terms, state.queryFilters, { addToHistory: false, preserveSelection: true, activeBranchId: null });
    }
    async setQueryTermPolarity(termId, polarity) {
        if (!this.experimentalVisual)
            return;
        const state = this.store.getSnapshot();
        const terms = state.queryTerms.map((term) => term.id === termId ? { ...term, polarity } : term);
        if (!terms.some((term) => term.polarity === 'positive')) {
            this.#feedback('Keep at least one positive query ingredient');
            return;
        }
        await this.#executeRecipe(terms, state.queryFilters, { addToHistory: false, preserveSelection: true, activeBranchId: null });
    }
    async addFilter(field, value, label) {
        const state = this.store.getSnapshot();
        const id = `${field}:${String(value).toLowerCase()}`;
        const filter = { id, field, value, label };
        const filters = [...state.queryFilters.filter((candidate) => candidate.field !== field || candidate.value !== value), filter].slice(0, 8);
        await this.#executeRecipe(state.queryTerms, filters, { addToHistory: false, preserveSelection: true, activeBranchId: null });
    }
    async removeFilter(filterId) {
        const state = this.store.getSnapshot();
        const filters = state.queryFilters.filter((filter) => filter.id !== filterId);
        await this.#executeRecipe(state.queryTerms, filters, { addToHistory: false, preserveSelection: true, activeBranchId: null });
    }
    async clearFilters() {
        const state = this.store.getSnapshot();
        await this.#executeRecipe(state.queryTerms, [], { addToHistory: false, preserveSelection: true, activeBranchId: null });
    }
    async showTruth() {
        const sequence = this.#activeSearchSequence;
        const state = this.store.getSnapshot();
        if (state.exact) {
            this.store.dispatch({ type: 'MODE_CHANGED', mode: 'truth' });
            return;
        }
        if (!state.queryVector)
            return;
        this.store.dispatch({ type: 'TRUTH_STARTED' });
        try {
            const request = {
                requestId: createRequestId('truth'),
                vector: [...state.queryVector],
                k: state.resultCount,
                efSearch: hasVisualEvidence(state.queryTerms)
                    ? state.visualIndexProgress.completed
                    : state.corpus?.items.length ?? state.efSearch,
                exact: true,
                queryKind: state.queryKind,
                queryText: this.#positiveText(state.queryTerms),
                filters: this.#searchFilters(state.queryFilters, state.scopedCollectionId)
            };
            const response = await this.#serviceForRecipe(state.queryTerms).search(request);
            if (sequence !== this.#activeSearchSequence)
                return;
            this.store.dispatch({ type: 'TRUTH_COMPLETED', response });
        }
        catch (error) {
            if (sequence !== this.#activeSearchSequence)
                return;
            this.store.dispatch({ type: 'SEARCH_FAILED', message: error instanceof Error ? error.message : String(error) });
        }
    }
    async findWeakQuery() {
        this.#recipeIntent++;
        const sequence = ++this.#activeSearchSequence;
        const state = this.store.getSnapshot();
        if (!state.corpus)
            return;
        this.store.dispatch({ type: 'PROBE_STARTED' });
        try {
            const efSearch = Math.min(9, Math.max(6, state.resultCount));
            const candidates = TRUTH_CHALLENGE_PROMPTS.map((text) => ({
                text,
                vector: [...this.#embeddingSpace.encodeText(text)]
            }));
            const result = await this.#recallProbe.findWeakest(candidates, {
                k: Math.min(state.resultCount, state.corpus.items.length),
                efSearch
            });
            const artworkId = result.approximate.hits[0]?.id ?? state.corpus.defaultQuery.exemplarArtworkId;
            if (sequence !== this.#activeSearchSequence)
                return;
            const history = this.#nextHistory(result.text, artworkId);
            saveHistory(history);
            this.store.dispatch({
                type: 'PROBE_COMPLETED',
                query: result.text,
                vector: result.vector,
                approximate: result.approximate,
                exact: result.exact,
                efSearch,
                history
            });
        }
        catch (error) {
            if (sequence !== this.#activeSearchSequence)
                return;
            this.store.dispatch({ type: 'SEARCH_FAILED', message: error instanceof Error ? error.message : String(error) });
        }
    }
    showFast() {
        this.store.dispatch({ type: 'MODE_CHANGED', mode: 'fast' });
    }
    selectArtwork(artworkId) {
        this.store.dispatch({ type: 'ARTWORK_SELECTED', artworkId });
    }
    setEfSearch(value) {
        this.#recipeIntent++;
        this.#activeSearchSequence++;
        const rounded = Math.round(value);
        this.store.dispatch({ type: 'EF_SEARCH_CHANGED', value: rounded });
        if (this.#tuningTimer !== null)
            window.clearTimeout(this.#tuningTimer);
        this.#tuningTimer = window.setTimeout(() => {
            this.#tuningTimer = null;
            void this.#rerunCurrentQuery();
        }, 90);
    }
    setClusterFilter(clusterId) {
        this.store.dispatch({ type: 'CLUSTER_FILTER_CHANGED', clusterId });
    }
    setRendererKind(kind) {
        this.store.dispatch({ type: 'RENDERER_READY', kind });
    }
    async replayRecent(entry) {
        await this.searchText(entry.text, false, false, true);
    }
    async branchCurrentSearch() {
        const state = this.store.getSnapshot();
        if (state.queryTerms.length === 0 || !this.#allowsRecipe(state.queryTerms))
            return;
        const branch = {
            id: createRequestId('branch'),
            name: shortTitle(state.activeQuery || 'Untitled search'),
            terms: cloneTerms(state.queryTerms),
            filters: [...state.queryFilters],
            createdAt: Date.now()
        };
        const branches = [branch, ...state.branches.filter((candidate) => candidate.name !== branch.name && this.#allowsRecipe(candidate.terms))].slice(0, 12);
        // Separate namespaces prevent default saves from evicting hidden visual work.
        if (this.experimentalVisual)
            saveBranches(branches);
        else
            saveTextBranches(branches);
        this.store.dispatch({ type: 'BRANCHES_CHANGED', branches, activeBranchId: branch.id });
        this.#feedback('Search branch saved');
    }
    async restoreBranch(branchId) {
        const branch = this.store.getSnapshot().branches.find((candidate) => candidate.id === branchId);
        if (!branch)
            return;
        if (await this.#executeRecipe(cloneTerms(branch.terms), [...branch.filters], { addToHistory: false, focusResults: false, activeBranchId: branch.id })) {
            this.#feedback(`Restored “${branch.name}”`);
        }
    }
    async saveCurrentCollection(name) {
        const state = this.store.getSnapshot();
        if (!state.queryVector || !state.corpus)
            return;
        try {
            const request = {
                requestId: createRequestId('collection-search'),
                vector: [...state.queryVector],
                k: Math.min(48, state.corpus.items.length),
                efSearch: Math.max(128, state.efSearch),
                exact: false,
                queryKind: state.queryKind,
                queryText: this.#positiveText(state.queryTerms),
                filters: this.#searchFilters(state.queryFilters, state.scopedCollectionId)
            };
            const response = await this.#serviceForRecipe(state.queryTerms).search(request);
            const title = name?.trim() || collectionName(state.activeQuery, state.savedCollections.length + 1);
            const collection = {
                id: createRequestId('collection'),
                name: title,
                artworkIds: response.hits.map((hit) => hit.id),
                createdAt: Date.now(),
                color: collectionColor(state.savedCollections.length)
            };
            const collections = [collection, ...state.savedCollections.filter((candidate) => candidate.name !== collection.name)].slice(0, 16);
            saveCollections(collections);
            this.store.dispatch({ type: 'COLLECTIONS_CHANGED', collections });
            this.#feedback(`Saved ${collection.artworkIds.length} artworks to “${collection.name}”`);
        }
        catch (error) {
            this.store.dispatch({ type: 'SEARCH_FAILED', message: error instanceof Error ? error.message : String(error) });
        }
    }
    async addArtworkToCollection(collectionId, artworkId) {
        const state = this.store.getSnapshot();
        const collections = state.savedCollections.map((collection) => collection.id === collectionId
            ? { ...collection, artworkIds: [...new Set([...collection.artworkIds, artworkId])] }
            : collection);
        saveCollections(collections);
        this.store.dispatch({ type: 'COLLECTIONS_CHANGED', collections });
        const collection = collections.find((candidate) => candidate.id === collectionId);
        if (collection)
            this.#feedback(`Added to “${collection.name}”`);
    }
    async createCollectionFromArtwork(artworkId) {
        const artwork = this.#artwork(artworkId);
        if (!artwork)
            return;
        const state = this.store.getSnapshot();
        const collection = {
            id: createRequestId('collection'),
            name: `Collection ${state.savedCollections.length + 1}`,
            artworkIds: [artworkId],
            createdAt: Date.now(),
            color: collectionColor(state.savedCollections.length)
        };
        const collections = [collection, ...state.savedCollections].slice(0, 16);
        saveCollections(collections);
        this.store.dispatch({ type: 'COLLECTIONS_CHANGED', collections });
        this.#feedback(`Created “${collection.name}”`);
    }
    async scopeCollection(collectionId) {
        const state = this.store.getSnapshot();
        this.store.dispatch({ type: 'COLLECTION_SCOPE_CHANGED', collectionId });
        if (state.queryTerms.length > 0) {
            await this.#executeRecipe(state.queryTerms, state.queryFilters, { addToHistory: false, preserveSelection: false, activeBranchId: state.activeBranchId });
        }
        if (collectionId)
            this.store.dispatch({ type: 'MAP_VIEW_CHANGED', view: 'wall' });
    }
    compareArtwork(artworkId) {
        const state = this.store.getSnapshot();
        const hitIds = (state.resultMode === 'truth' && state.exact ? state.exact.hits : state.approximate?.hits ?? []).map((hit) => hit.id);
        const counterpart = hitIds.find((id) => id !== artworkId) ?? state.queryArtworkId;
        const ids = counterpart && counterpart !== artworkId ? [counterpart, artworkId] : [artworkId];
        this.store.dispatch({ type: 'COMPARE_CHANGED', artworkIds: ids });
        this.#feedback(ids.length === 2 ? 'Comparison opened' : 'Choose one more artwork to compare');
    }
    clearCompare() {
        this.store.dispatch({ type: 'COMPARE_CHANGED', artworkIds: [] });
    }
    dispose() {
        this.#disposed = true;
        this.#recipeIntent++;
        this.#activeSearchSequence++;
        if (this.#tuningTimer !== null)
            window.clearTimeout(this.#tuningTimer);
        if (this.#feedbackTimer !== null)
            window.clearTimeout(this.#feedbackTimer);
        this.#releaseCorpusImages?.();
        this.#releaseCorpusImages = null;
        this.#searchService.dispose();
        this.#visualSearchService.dispose();
    }
    async #addArtworkReference(artworkId, polarity, pinned, weight, labelPrefix) {
        if (!this.experimentalVisual)
            return;
        const artwork = this.#artwork(artworkId);
        if (!artwork)
            return;
        const state = this.store.getSnapshot();
        const term = this.#artworkTerm(artwork, polarity, pinned, weight, labelPrefix);
        const terms = [...state.queryTerms.filter((candidate) => candidate.artworkId !== artworkId), term].slice(-10);
        await this.#executeRecipe(terms, state.queryFilters, { addToHistory: true, focusResults: false, activeBranchId: null });
        this.#feedback(polarity === 'negative' ? 'Result moved away from the query' : pinned ? 'Artwork pinned to the query' : 'Artwork added as a reference');
    }
    #textTerm(text) {
        return {
            id: 'primary-text',
            kind: 'text',
            polarity: 'positive',
            label: text.trim(),
            vector: [...this.#embeddingSpace.encodeText(text)],
            weight: 1
        };
    }
    #artworkTerm(artwork, polarity, pinned, weight, labelPrefix = 'Reference') {
        return {
            id: createRequestId('artwork-term'),
            kind: 'artwork',
            polarity,
            label: `${labelPrefix}: ${shortTitle(artwork.title)}`,
            vector: [...(this.#metadataArtworkVectors.get(artwork.id) ?? artwork.vector)],
            weight,
            artworkId: artwork.id,
            previewUrl: artwork.thumbnailUrl ?? artwork.imageUrl,
            pinned
        };
    }
    async #executeRecipe(terms, filters, options = {}) {
        if (!this.#allowsRecipe(terms))
            return false;
        const intent = options.intent ?? this.#beginRecipeIntent();
        if (!this.#isCurrentIntent(intent))
            return false;
        const positiveTerms = terms.filter((term) => term.polarity === 'positive');
        if (positiveTerms.length === 0) {
            this.#feedback('Add at least one positive query ingredient');
            return false;
        }
        if (hasVisualEvidence(terms)) {
            try {
                await this.#ensureVisualIndex();
            }
            catch (error) {
                if (this.#isCurrentIntent(intent))
                    this.store.dispatch({ type: 'SEARCH_FAILED', message: error instanceof Error ? error.message : String(error) });
                return false;
            }
            if (!this.#isCurrentIntent(intent))
                return false;
        }
        const vector = composeWeightedQuery(terms.map((term) => ({ vector: term.vector, weight: term.weight, polarity: term.polarity })), this.#embeddingSpace.dimensions.length);
        const queryKind = recipeKind(terms);
        const queryText = recipeLabel(terms);
        const queryArtworkId = singleArtworkQueryId(terms);
        const previewUrl = terms.find((term) => (term.kind === 'image' || term.kind === 'detail') && term.previewUrl)?.previewUrl ?? null;
        this.store.dispatch({ type: 'QUERY_RECIPE_CHANGED', terms: cloneTerms(terms), filters: [...filters], activeBranchId: options.activeBranchId });
        await this.#runApproximate(queryText, queryKind, vector, queryArtworkId, options.addToHistory ?? false, previewUrl, options.preserveTruth ?? false, options.preserveSelection ?? false, options.autoInspect ?? true, options.focusResults ?? false, filters);
        return this.#isCurrentIntent(intent);
    }
    #prepareSemanticCorpus(corpus) {
        const items = corpus.items.map((item) => {
            const visual = item.visualVector?.length === corpus.embedding.visualDimensions ? item.visualVector : undefined;
            return { ...item, vector: [...this.#embeddingSpace.encodeArtwork(item, visual)] };
        });
        const packMode = corpus.source.mode === 'met-pack' || corpus.source.mode === 'met-hybrid-pack';
        return {
            ...corpus,
            dimensions: this.#embeddingSpace.dimensions,
            embedding: {
                kind: packMode ? 'metadata-art-v3' : 'hybrid-art-v2',
                semanticDimensions: corpus.embedding.semanticDimensions,
                visualDimensions: corpus.embedding.visualDimensions,
                description: packMode
                    ? 'Field-weighted Met metadata over a versioned search pack. Opening previews are verified locally; remaining artwork images load lazily from official Open Access assets.'
                    : 'Field-weighted museum metadata plus a browser-computed color, luminance, edge, and composition descriptor.'
            },
            items
        };
    }
    async #enrichVisualIndex(corpus) {
        if (this.#disposed)
            return;
        const packMode = corpus.source.mode === 'met-pack' || corpus.source.mode === 'met-hybrid-pack';
        const targetCount = packMode
            ? Math.min(corpus.items.length, corpus.source.previewImageCount ?? 72, 72)
            : corpus.items.length;
        const targets = packMode
            ? corpus.items
                .filter((item) => item.previewRank && item.previewRank <= targetCount)
                .sort((left, right) => (left.previewRank ?? Number.MAX_SAFE_INTEGER) - (right.previewRank ?? Number.MAX_SAFE_INTEGER))
                .slice(0, targetCount)
            : [...corpus.items];
        const verifiedTargets = targets.filter((item) => item.imageOptimized && Boolean(item.thumbnailUrl ?? item.imageUrl));
        if (verifiedTargets.length < Math.min(12, targetCount)) {
            this.store.dispatch({ type: 'VISUAL_INDEX_FAILED' });
            return;
        }
        const packId = corpus.source.packId ?? corpus.source.id;
        const cached = loadVisualCache(packId);
        const visualById = new Map();
        for (const item of verifiedTargets) {
            const vector = cached.get(item.id);
            if (isValidVisualDescriptor(vector, corpus.embedding.visualDimensions))
                visualById.set(item.id, vector);
        }
        const missing = verifiedTargets.filter((item) => !visualById.has(item.id));
        this.store.dispatch({ type: 'VISUAL_INDEX_STARTED', total: verifiedTargets.length });
        this.store.dispatch({ type: 'VISUAL_INDEX_PROGRESS', completed: visualById.size, total: verifiedTargets.length, failures: 0 });
        try {
            if (missing.length > 0) {
                const enricher = new VisualIndexEnricher(this.#embeddingSpace, 4);
                const enrichedMissing = await enricher.enrich(missing, (progress) => {
                    if (this.#disposed)
                        return;
                    this.store.dispatch({
                        type: 'VISUAL_INDEX_PROGRESS',
                        completed: visualById.size + progress.completed,
                        total: verifiedTargets.length,
                        failures: progress.failures
                    });
                });
                if (this.#disposed)
                    return;
                for (const item of enrichedMissing) {
                    if (isValidVisualDescriptor(item.visualVector, corpus.embedding.visualDimensions))
                        visualById.set(item.id, item.visualVector);
                }
            }
            const minimumReady = Math.min(24, verifiedTargets.length);
            if (visualById.size < minimumReady)
                throw new Error('Too few local artwork previews could be visually indexed.');
            saveVisualCache(packId, visualById);
            const items = corpus.items.map((item) => {
                const visual = visualById.get(item.id);
                return visual
                    ? { ...item, visualVector: [...visual] }
                    : item;
            });
            const enrichedCorpus = {
                ...corpus,
                embedding: {
                    ...corpus.embedding,
                    kind: 'hybrid-art-v2',
                    description: `Field-weighted museum metadata plus local visual descriptors for ${visualById.size.toLocaleString()} opening artworks.`
                },
                items
            };
            const visualItems = items.filter((item) => visualById.has(item.id))
                .map((item) => ({ ...item, vector: [...this.#embeddingSpace.encodeArtwork(item, item.visualVector)] }));
            if (this.#disposed)
                return;
            await this.#visualSearchService.initialize(visualItems);
            if (this.#disposed)
                return;
            this.store.dispatch({ type: 'VISUAL_INDEX_READY', corpus: enrichedCorpus });
        }
        catch {
            if (this.#disposed)
                return;
            this.store.dispatch({ type: 'VISUAL_INDEX_FAILED' });
        }
    }
    async #rerunCurrentQuery(preserveTruth = true) {
        const state = this.store.getSnapshot();
        if (state.queryTerms.length === 0)
            return;
        await this.#executeRecipe(state.queryTerms, state.queryFilters, {
            addToHistory: false,
            preserveTruth,
            preserveSelection: true,
            autoInspect: false,
            focusResults: false,
            activeBranchId: state.activeBranchId
        });
    }
    async #runApproximate(text, queryKind, vector, artworkId, addToHistory, uploadedPreviewUrl = null, preserveTruth = false, preserveSelection = false, autoInspect = true, focusResults = true, filters = []) {
        const sequence = ++this.#activeSearchSequence;
        const state = this.store.getSnapshot();
        this.store.dispatch({ type: 'SEARCH_STARTED', query: text, queryKind, vector: [...vector], artworkId, uploadedPreviewUrl, preserveTruth, preserveSelection });
        try {
            const request = {
                requestId: createRequestId('search'),
                vector: [...vector],
                k: Math.min(state.resultCount, state.corpus?.items.length ?? state.resultCount),
                efSearch: effectiveSearchBudget(state),
                exact: false,
                queryKind,
                queryText: this.#positiveText(this.store.getSnapshot().queryTerms),
                filters: this.#searchFilters(filters, this.store.getSnapshot().scopedCollectionId)
            };
            const response = await this.#serviceForRecipe(this.store.getSnapshot().queryTerms).search(request);
            if (sequence !== this.#activeSearchSequence)
                return;
            const historyArtworkId = artworkId ?? response.hits[0]?.id ?? '';
            const terms = this.store.getSnapshot().queryTerms;
            const saveTextHistory = addToHistory && terms.length === 1 && terms[0]?.kind === 'text' && terms[0]?.polarity === 'positive';
            const history = saveTextHistory ? this.#nextHistory(text, historyArtworkId) : this.store.getSnapshot().history;
            if (saveTextHistory)
                saveHistory(history);
            this.store.dispatch({ type: 'SEARCH_COMPLETED', response, history });
            if (autoInspect && response.hits[0]) {
                this.store.dispatch({ type: 'ARTWORK_SELECTED', artworkId: response.hits[0].id });
                if (focusResults)
                    this.store.dispatch({ type: 'MAP_VIEW_CHANGED', view: 'focus' });
            }
        }
        catch (error) {
            if (sequence !== this.#activeSearchSequence)
                return;
            this.store.dispatch({ type: 'SEARCH_FAILED', message: error instanceof Error ? error.message : String(error) });
        }
    }
    #serviceForRecipe(terms) {
        return hasVisualEvidence(terms) && !this.#visualUsesMainIndex
            ? this.#visualSearchService
            : this.#searchService;
    }
    async #ensureVisualIndex() {
        if (!this.experimentalVisual)
            return;
        const corpus = this.store.getSnapshot().corpus;
        if (!this.#visualReadyPromise && corpus)
            this.#visualReadyPromise = this.#enrichVisualIndex(corpus);
        await (this.#visualReadyPromise ?? Promise.resolve());
        if (!this.#disposed && this.store.getSnapshot().indexPhase !== 'hybrid') {
            throw new Error('Visual reference search is unavailable: too few artwork previews could be prepared. Text search remains available.');
        }
    }
    #beginRecipeIntent() {
        this.#activeSearchSequence++;
        return ++this.#recipeIntent;
    }
    #allowsRecipe(terms) {
        return this.experimentalVisual || terms.every(term => term.kind === 'text' && term.polarity === 'positive');
    }
    #isCurrentIntent(intent) {
        return !this.#disposed && intent === this.#recipeIntent;
    }
    async #loadSearchCorpus() {
        const progress = (completed, total) => this.store.dispatch({ type: 'INDEX_BUILD_PROGRESS', completed, total });
        if (typeof Worker !== 'undefined') {
            try {
                return await this.#searchService.loadCorpus('/data/corpus.json', progress);
            }
            catch (error) {
                if (this.#disposed)
                    throw error;
                // Preserve the in-process fallback when module workers are unavailable.
            }
        }
        const corpus = this.#prepareSemanticCorpus(await this.#corpusRepository.load());
        await this.#searchService.initialize(corpus.items, progress);
        return corpus;
    }
    #positiveText(terms) {
        const text = terms.filter((term) => term.kind === 'text' && term.polarity === 'positive').map((term) => term.label).join(' ');
        return text || undefined;
    }
    #searchFilters(filters, scopedCollectionId) {
        const result = {};
        for (const filter of filters) {
            if (filter.field === 'cluster')
                (result.clusterIds ??= []).push(String(filter.value));
            else if (filter.field === 'culture')
                (result.cultures ??= []).push(String(filter.value));
            else if (filter.field === 'department')
                (result.departments ??= []).push(String(filter.value));
            else if (filter.field === 'medium')
                (result.mediums ??= []).push(String(filter.value));
            else if (filter.field === 'classification')
                (result.classifications ??= []).push(String(filter.value));
            else if (filter.field === 'before')
                result.yearBefore = Number(filter.value);
            else if (filter.field === 'after')
                result.yearAfter = Number(filter.value);
        }
        if (scopedCollectionId) {
            const collection = this.store.getSnapshot().savedCollections.find((candidate) => candidate.id === scopedCollectionId);
            if (collection)
                result.ids = [...collection.artworkIds];
        }
        return Object.keys(result).length > 0 ? result : undefined;
    }
    #seedHistory(corpus) {
        const now = Date.now();
        const preferred = [
            ['a dramatic landscape under a restless sky', ['landscapes', 'nocturnes']],
            ['someone deeply unimpressed', ['figures']],
            ['armor that looks alive', ['armor', 'objects']]
        ];
        return preferred.map(([text, clusters], index) => {
            const artwork = corpus.items.find((item) => clusters.includes(item.clusterId)) ?? corpus.items[index] ?? corpus.items[0];
            return {
                id: `seed-history-${index}`,
                text,
                artworkId: artwork?.id ?? corpus.defaultQuery.exemplarArtworkId,
                searchedAt: now - [25_000, 2 * 3_600_000, 26 * 3_600_000][index]
            };
        });
    }
    #nextHistory(text, artworkId) {
        const current = this.store.getSnapshot().history;
        const normalized = text.trim().toLowerCase();
        const withoutDuplicate = current.filter((entry) => entry.text.trim().toLowerCase() !== normalized);
        return [{ id: createRequestId('history'), text, artworkId, searchedAt: Date.now() }, ...withoutDuplicate].slice(0, 8);
    }
    #artwork(id) {
        return this.store.getSnapshot().corpus?.items.find((item) => item.id === id) ?? null;
    }
    #feedback(message) {
        if (this.#feedbackTimer !== null)
            window.clearTimeout(this.#feedbackTimer);
        this.store.dispatch({ type: 'FEEDBACK_CHANGED', message });
        this.#feedbackTimer = window.setTimeout(() => {
            this.#feedbackTimer = null;
            this.store.dispatch({ type: 'FEEDBACK_CHANGED', message: null });
        }, 2200);
    }
}
function recipeKind(terms) {
    if (terms.some((term) => term.kind === 'text'))
        return 'text';
    if (terms.some((term) => term.kind === 'artwork'))
        return 'artwork';
    return 'image';
}
function hasVisualEvidence(terms) {
    return terms.some((term) => term.kind === 'image' || term.kind === 'detail');
}
function isValidVisualDescriptor(vector, dimensions) {
    return vector?.length === dimensions && vector.every(Number.isFinite) && Math.abs(Math.hypot(...vector) - 1) <= 1e-3;
}
function recipeLabel(terms) {
    const text = terms.find((term) => term.kind === 'text' && term.polarity === 'positive')?.label;
    if (text)
        return text;
    const positive = terms.find((term) => term.polarity === 'positive');
    return positive?.label ?? 'Visual query';
}
function singleArtworkQueryId(terms) {
    const positives = terms.filter((term) => term.polarity === 'positive');
    return positives.length === 1 && positives[0]?.kind === 'artwork' ? positives[0].artworkId ?? null : null;
}
function cloneTerms(terms) {
    return terms.map((term) => ({ ...term, vector: [...term.vector], crop: term.crop ? { ...term.crop } : term.crop }));
}
function shortTitle(value) {
    const trimmed = value.trim();
    return trimmed.length <= 42 ? trimmed : `${trimmed.slice(0, 39).trim()}…`;
}
function collectionName(query, ordinal) {
    const clean = query.trim().replace(/^(a|an|the)\s+/i, '');
    if (!clean)
        return `Collection ${ordinal}`;
    return clean.split(/\s+/).slice(0, 4).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('The image could not be read.'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
    });
}
//# sourceMappingURL=app.runtime.js.map