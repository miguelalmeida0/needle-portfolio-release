export class VisualIndexEnricher {
    #space;
    #concurrency;
    constructor(space, concurrency = 4) {
        this.#space = space;
        this.#concurrency = Math.max(1, concurrency);
    }
    async enrich(items, onProgress) {
        const enriched = [...items];
        let cursor = 0;
        let completed = 0;
        let failures = 0;
        const worker = async () => {
            while (cursor < items.length) {
                const index = cursor++;
                const item = items[index];
                if (!item)
                    continue;
                try {
                    const visual = item.visualVector?.length
                        ? Float32Array.from(item.visualVector)
                        : await this.#space.describeArtworkImage(item.thumbnailUrl ?? item.imageUrl);
                    enriched[index] = { ...item, visualVector: [...visual], vector: [...this.#space.encodeArtwork(item, visual)] };
                }
                catch {
                    failures += 1;
                }
                finally {
                    completed += 1;
                    onProgress({ completed, total: items.length, failures });
                    await yieldToBrowser();
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(this.#concurrency, items.length) }, worker));
        return enriched;
    }
}
function yieldToBrowser() {
    return new Promise((resolve) => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => resolve(), { timeout: 40 });
        }
        else {
            globalThis.setTimeout(resolve, 0);
        }
    });
}
//# sourceMappingURL=visual-index-enricher.js.map