const DEFAULT_CONCURRENCY = 12;
const ARTWORK_CACHE = 'needle-artwork-demo-v6';
const PRELOAD_DEADLINE_MS = 20_000;
const REQUEST_TIMEOUT_MS = 5_000;
const DECODE_TIMEOUT_MS = 3_000;
export async function preloadCorpusImages(corpus, onProgress = () => undefined, concurrency = DEFAULT_CONCURRENCY) {
    if (corpus.source.assetMode === 'local-pack' || corpus.source.assetMode === 'local-preview-remote-detail') {
        return preloadLocalPackPreviews(corpus, onProgress, concurrency);
    }
    if (corpus.source.assetMode !== 'verified-preload') {
        return { corpus, release: () => undefined };
    }
    const required = Math.max(1, Math.min(corpus.items.length, corpus.source.requiredImageCount ?? corpus.source.imageCount));
    const queue = interleaveByCluster(corpus.items);
    const deadlineAt = Date.now() + PRELOAD_DEADLINE_MS;
    const loaded = new Map();
    let cursor = 0;
    let completed = 0;
    let failed = 0;
    let stop = false;
    onProgress({ completed, succeeded: 0, failed, required, total: queue.length });
    const worker = async () => {
        while (!stop) {
            const index = cursor;
            cursor += 1;
            const artwork = queue[index];
            if (!artwork)
                return;
            try {
                const result = await loadArtwork(artwork, deadlineAt);
                loaded.set(artwork.id, result);
            }
            catch {
                failed += 1;
            }
            finally {
                completed += 1;
                onProgress({ completed, succeeded: loaded.size, failed, required, total: queue.length });
                if (loaded.size >= required)
                    stop = true;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), queue.length) }, worker));
    if (loaded.size < required) {
        for (const item of loaded.values())
            if (item.revoke)
                URL.revokeObjectURL(item.resolvedUrl);
        throw new Error(`Needle could load only ${loaded.size} of ${required} required artwork images. `
            + 'Check that Wikimedia Commons is reachable, then reload.');
    }
    const selectedIds = new Set();
    const selected = [];
    for (const artwork of queue) {
        const result = loaded.get(artwork.id);
        if (!result || selected.length >= required)
            continue;
        selectedIds.add(artwork.id);
        selected.push({
            ...artwork,
            imageUrl: result.resolvedUrl,
            thumbnailUrl: result.resolvedUrl,
            detailImageUrl: result.resolvedUrl,
            thumbnailFallbackUrls: [],
            detailImageFallbackUrls: [],
            imageOptimized: true
        });
    }
    for (const [id, result] of loaded) {
        if (!selectedIds.has(id) && result.revoke)
            URL.revokeObjectURL(result.resolvedUrl);
    }
    const selectedIdSet = new Set(selected.map((item) => item.id));
    const clusters = corpus.clusters.filter((cluster) => selected.some((item) => item.clusterId === cluster.id));
    const exemplarArtworkId = selectedIdSet.has(corpus.defaultQuery.exemplarArtworkId)
        ? corpus.defaultQuery.exemplarArtworkId
        : selected.find((item) => item.clusterId === 'animals')?.id ?? selected[0].id;
    const prepared = {
        ...corpus,
        source: {
            ...corpus.source,
            imageCount: selected.length,
            label: `The Met Open Access · ${selected.length} images ready`
        },
        items: selected,
        clusters,
        defaultQuery: { ...corpus.defaultQuery, exemplarArtworkId }
    };
    return {
        corpus: prepared,
        release: () => {
            for (const id of selectedIds) {
                const result = loaded.get(id);
                if (result?.revoke)
                    URL.revokeObjectURL(result.resolvedUrl);
            }
        }
    };
}
async function preloadLocalPackPreviews(corpus, onProgress, concurrency) {
    const configuredPreviewCount = corpus.source.previewImageCount ?? Math.min(96, corpus.items.length);
    const viewportTarget = typeof window === 'undefined'
        ? 84
        : window.innerWidth < 640
            ? 32
            : window.innerWidth < 980
                ? 48
                : 72;
    const previewCount = Math.max(1, Math.min(corpus.items.length, configuredPreviewCount, viewportTarget));
    const previews = corpus.items
        .filter((item) => item.previewRank && item.previewRank <= previewCount)
        .sort((left, right) => (left.previewRank ?? Number.MAX_SAFE_INTEGER) - (right.previewRank ?? Number.MAX_SAFE_INTEGER))
        .slice(0, previewCount);
    if (previews.length !== previewCount) {
        throw new Error(`The active pack exposes ${previews.length} of ${previewCount} required opening-preview images.`);
    }
    const deadlineAt = Date.now() + 90_000;
    let cursor = 0;
    let completed = 0;
    let succeeded = 0;
    let failed = 0;
    const failures = [];
    onProgress({ completed, succeeded, failed, required: previewCount, total: previewCount });
    const worker = async () => {
        while (true) {
            const index = cursor;
            cursor += 1;
            const artwork = previews[index];
            if (!artwork)
                return;
            try {
                await decodeImage(artwork.thumbnailUrl ?? artwork.imageUrl, deadlineAt, 15_000);
                succeeded += 1;
            }
            catch {
                failed += 1;
                failures.push(artwork.id);
            }
            finally {
                completed += 1;
                onProgress({ completed, succeeded, failed, required: previewCount, total: previewCount });
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency * 2), 32, previews.length) }, worker));
    if (failed > 0) {
        throw new Error(`The local data pack has ${failed} unreadable opening-preview ${failed === 1 ? 'image' : 'images'} `
            + `(${failures.slice(0, 5).join(', ')}${failures.length > 5 ? ', …' : ''}). Run npm run data:verify or reinstall the pack.`);
    }
    return { corpus, release: () => undefined };
}
function interleaveByCluster(items) {
    const groups = new Map();
    for (const item of items) {
        const group = groups.get(item.clusterId) ?? [];
        group.push(item);
        groups.set(item.clusterId, group);
    }
    const result = [];
    let level = 0;
    while (result.length < items.length) {
        let added = false;
        for (const group of groups.values()) {
            const item = group[level];
            if (!item)
                continue;
            result.push(item);
            added = true;
        }
        if (!added)
            break;
        level += 1;
    }
    return result;
}
async function loadArtwork(artwork, deadlineAt) {
    const sources = uniqueSources([
        artwork.thumbnailUrl,
        ...(artwork.thumbnailFallbackUrls ?? []),
        artwork.imageUrl
    ]);
    let lastError = null;
    for (const source of sources) {
        if (Date.now() >= deadlineAt)
            throw new Error('Artwork preload deadline exceeded.');
        try {
            const loaded = await fetchAsObjectUrl(source, deadlineAt);
            return { artwork, ...loaded };
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError ?? new Error(`No usable image source for ${artwork.title}.`);
}
async function fetchAsObjectUrl(source, deadlineAt) {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0)
        throw new Error('Artwork preload deadline exceeded.');
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remaining));
    try {
        const cache = 'caches' in globalThis ? await caches.open(ARTWORK_CACHE).catch(() => null) : null;
        let response = cache ? await cache.match(source) : undefined;
        if (!response) {
            response = await fetch(source, {
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit',
                cache: 'force-cache',
                referrerPolicy: 'no-referrer'
            });
            if (response.ok && cache)
                await cache.put(source, response.clone()).catch(() => undefined);
        }
        if (!response.ok)
            throw new Error(`Image request failed with ${response.status}.`);
        const type = response.headers.get('content-type') ?? '';
        if (!type.toLowerCase().startsWith('image/'))
            throw new Error(`Expected an image but received ${type || 'an unknown type'}.`);
        const blob = await response.blob();
        if (blob.size < 1_024)
            throw new Error('Image response was unexpectedly small.');
        const objectUrl = URL.createObjectURL(blob);
        try {
            await decodeImage(objectUrl, deadlineAt);
            return { resolvedUrl: objectUrl, revoke: true };
        }
        catch (error) {
            URL.revokeObjectURL(objectUrl);
            throw error;
        }
    }
    catch (fetchError) {
        // A browser or network policy may deny CORS while still allowing the image element.
        // Decode the same URL directly before rejecting the artwork.
        try {
            await decodeImage(source, deadlineAt);
            return { resolvedUrl: source, revoke: false };
        }
        catch {
            throw fetchError;
        }
    }
    finally {
        globalThis.clearTimeout(timeout);
    }
}
function decodeImage(source, deadlineAt, timeoutMs = DECODE_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const remaining = deadlineAt - Date.now();
        if (remaining <= 0) {
            reject(new Error('Artwork preload deadline exceeded.'));
            return;
        }
        const image = new Image();
        const timeout = globalThis.setTimeout(() => {
            cleanup();
            image.src = '';
            reject(new Error('Artwork image decode timed out.'));
        }, Math.min(timeoutMs, remaining));
        const cleanup = () => {
            globalThis.clearTimeout(timeout);
            image.onload = null;
            image.onerror = null;
        };
        image.decoding = 'async';
        image.loading = 'eager';
        image.referrerPolicy = 'no-referrer';
        image.onload = () => {
            cleanup();
            if (image.naturalWidth < 24 || image.naturalHeight < 24) {
                reject(new Error('Artwork image has invalid dimensions.'));
                return;
            }
            resolve();
        };
        image.onerror = () => {
            cleanup();
            reject(new Error('Artwork image could not be decoded.'));
        };
        image.src = source;
    });
}
function uniqueSources(sources) {
    return [...new Set(sources.filter((source) => Boolean(source?.trim())))];
}
//# sourceMappingURL=image-preloader.js.map