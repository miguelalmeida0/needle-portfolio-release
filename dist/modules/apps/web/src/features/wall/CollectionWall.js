import { React, useEffect, useMemo, useRef, useState } from '../../shared/react.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
import { useAppRuntime, useGalleryState } from '../../app/app.context.js';
import { matchesQueryFilters, scopedCorpusItems, visibleHits } from '../../app/app.selectors.js';
import { wallWindow } from './wall-window.js';
const OUTER_PADDING = 22;
const GAP = 14;
const positions = new Map();
export function CollectionWall() {
    const runtime = useAppRuntime();
    const state = useGalleryState();
    const containerRef = useRef(null);
    const frameRef = useRef(0);
    const scrollPositionRef = useRef(0);
    const positionKey = `${state.corpus?.source.packId}:${state.activeQuery}:${state.activeClusterId}:${JSON.stringify(state.queryFilters)}:${state.scopedCollectionId}`;
    const [viewport, setViewport] = useState({ width: 900, height: 680, scrollTop: 0 });
    const hitRanks = useMemo(() => new Map(visibleHits(state).map((hit) => [hit.id, hit.rank])), [state.approximate, state.exact, state.resultMode]);
    const items = useMemo(() => {
        const source = scopedCorpusItems(state);
        const recipeFiltered = state.queryFilters.length > 0 ? source.filter((item) => matchesQueryFilters(item, state.queryFilters)) : [...source];
        const filtered = state.activeClusterId ? recipeFiltered.filter((item) => item.clusterId === state.activeClusterId) : recipeFiltered;
        return filtered.sort((left, right) => {
            const leftRank = hitRanks.get(left.id) ?? Number.MAX_SAFE_INTEGER;
            const rightRank = hitRanks.get(right.id) ?? Number.MAX_SAFE_INTEGER;
            return leftRank - rightRank
                || Number(right.isHighlight) - Number(left.isHighlight)
                || (left.previewRank ?? Number.MAX_SAFE_INTEGER) - (right.previewRank ?? Number.MAX_SAFE_INTEGER)
                || left.title.localeCompare(right.title);
        });
    }, [state.corpus, state.activeClusterId, state.queryFilters, state.scopedCollectionId, state.savedCollections, hitRanks]);
    useEffect(() => {
        const element = containerRef.current;
        if (!element)
            return undefined;
        const update = () => {
            const rect = element.getBoundingClientRect();
            setViewport((current) => ({ ...current, width: rect.width, height: rect.height }));
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const element = containerRef.current;
        if (!element)
            return;
        element.scrollTop = positions.get(positionKey) ?? 0;
        scrollPositionRef.current = element.scrollTop;
        setViewport((current) => ({ ...current, scrollTop: element.scrollTop }));
        return () => {
            cancelAnimationFrame(frameRef.current);
            positions.delete(positionKey);
            positions.set(positionKey, scrollPositionRef.current);
            if (positions.size > 16)
                positions.delete(positions.keys().next().value);
        };
    }, [positionKey]);
    const preferredWidth = viewport.width < 620 ? 132 : viewport.width < 980 ? 148 : 166;
    const columns = Math.max(2, Math.floor((viewport.width - OUTER_PADDING * 2 + GAP) / (preferredWidth + GAP)));
    const cardWidth = Math.max(112, (viewport.width - OUTER_PADDING * 2 - GAP * (columns - 1)) / columns);
    const imageHeight = Math.round(cardWidth * 1.08);
    const rowHeight = imageHeight + 70 + GAP;
    const rowCount = Math.ceil(items.length / columns);
    const { start: startIndex, end: endIndex } = wallWindow(items.length, columns, rowHeight, viewport.height, viewport.scrollTop);
    const visible = items.slice(startIndex, endIndex);
    return (React.createElement("section", { ref: containerRef, className: "collection-wall", "aria-label": `Collection wall with ${items.length.toLocaleString()} image-backed artworks`, onScroll: (event) => {
            const scrollTop = event.currentTarget.scrollTop;
            scrollPositionRef.current = scrollTop;
            cancelAnimationFrame(frameRef.current);
            frameRef.current = requestAnimationFrame(() => setViewport((current) => ({ ...current, scrollTop })));
        }, onKeyDown: (event) => {
            const index = Number(event.target.closest('[data-index]')?.dataset.index);
            if (!Number.isFinite(index))
                return;
            const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns : event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0;
            if (!delta)
                return;
            const next = index + delta;
            if (next < 0 || next >= items.length)
                return;
            event.preventDefault();
            const element = containerRef.current;
            if (!element)
                return;
            const top = Math.floor(next / columns) * rowHeight;
            if (top < element.scrollTop || top + rowHeight > element.scrollTop + viewport.height) {
                element.scrollTop = top;
                setViewport((current) => ({ ...current, scrollTop: top }));
            }
            requestAnimationFrame(() => element.querySelector(`[data-index="${next}"]`)?.focus({ preventScroll: true }));
        } },
        React.createElement("header", { className: "collection-wall__header" },
            React.createElement("div", null,
                React.createElement("strong", null,
                    items.length.toLocaleString(),
                    " image-backed works"),
                React.createElement("span", null, "Virtualized local collection \u00B7 only visible cards are mounted")),
            React.createElement("span", null,
                columns,
                " columns \u00B7 ",
                visible.length,
                " cards rendered")),
        React.createElement("div", { className: "collection-wall__stage", style: { height: `${Math.max(viewport.height, rowCount * rowHeight + OUTER_PADDING * 2)}px` } }, visible.map((artwork, localIndex) => {
            const index = startIndex + localIndex;
            const column = index % columns;
            const row = Math.floor(index / columns);
            const rank = hitRanks.get(artwork.id);
            const selected = state.selectedArtworkId === artwork.id;
            return (React.createElement("button", { type: "button", "data-artwork-id": artwork.id, "data-index": index, className: `collection-card${selected ? ' is-selected' : ''}${rank ? ' is-result' : ''}`, key: artwork.id, style: {
                    width: `${cardWidth}px`,
                    transform: `translate3d(${OUTER_PADDING + column * (cardWidth + GAP)}px, ${OUTER_PADDING + row * rowHeight}px, 0)`
                }, onClick: () => runtime.selectArtwork(artwork.id), "aria-label": `${artwork.title} by ${artwork.creator}${rank ? `, result ${rank}` : ''}` },
                React.createElement("span", { className: "collection-card__image", style: { height: `${imageHeight}px` } },
                    React.createElement(ArtworkImage, { src: artwork.thumbnailUrl ?? artwork.imageUrl, alt: artwork.title, eager: row === Math.floor(viewport.scrollTop / rowHeight), priority: index < 2 && viewport.scrollTop === 0, sizes: `${Math.round(cardWidth - 14)}px`, width: artwork.imageWidth, height: artwork.imageHeight, dominantColor: artwork.dominantColor }),
                    rank && React.createElement("b", { className: "collection-card__rank" },
                        "#",
                        rank)),
                React.createElement("span", { className: "collection-card__copy" },
                    React.createElement("strong", null, artwork.title),
                    React.createElement("small", null, artwork.creator || 'Unknown maker'),
                    React.createElement("small", null, artwork.objectDate || artwork.clusterLabel))));
        }))));
}
//# sourceMappingURL=CollectionWall.js.map