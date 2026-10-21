import {
  React,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "../../dist/modules/apps/web/src/shared/react.js";
import { ArtworkImage } from "../../dist/modules/apps/web/src/shared/ui/ArtworkImage.js";
import {
  useAppRuntime,
  useGalleryState,
} from "../../dist/modules/apps/web/src/app/app.context.js";
import {
  matchesQueryFilters,
  scopedCorpusItems,
  visibleHits,
} from "../../dist/modules/apps/web/src/app/app.selectors.js";
import { wallWindow } from "../../dist/modules/apps/web/src/features/wall/wall-window.js";

const positions = new Map();

// Keep the deployed wall's selection, ordering, windowing and keyboard behavior.
// Only the image geometry and visible presentation differ from that component.
export function CollectionWall({ onOpen, scrollRef } = {}) {
  const runtime = useAppRuntime();
  const state = useGalleryState();
  const containerRef = useRef(null);
  const frameRef = useRef(0);
  const scrollPositionRef = useRef(0);
  const positionKey = `${state.corpus?.source.packId}:${state.activeQuery}:${state.activeClusterId}:${JSON.stringify(state.queryFilters)}:${state.scopedCollectionId}`;
  const [viewport, setViewport] = useState({
    width: 900,
    height: 680,
    scrollTop: 0,
  });
  const hitRanks = useMemo(
    () => new Map(visibleHits(state).map((hit) => [hit.id, hit.rank])),
    [state.approximate, state.exact, state.resultMode],
  );
  const items = useMemo(() => {
    const source = scopedCorpusItems(state);
    const recipeFiltered =
      state.queryFilters.length > 0
        ? source.filter((item) => matchesQueryFilters(item, state.queryFilters))
        : [...source];
    const filtered = state.activeClusterId
      ? recipeFiltered.filter(
          (item) => item.clusterId === state.activeClusterId,
        )
      : recipeFiltered;
    return filtered.sort((left, right) => {
      const leftRank = hitRanks.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = hitRanks.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return (
        leftRank - rightRank ||
        Number(right.isHighlight) - Number(left.isHighlight) ||
        (left.previewRank ?? Number.MAX_SAFE_INTEGER) -
          (right.previewRank ?? Number.MAX_SAFE_INTEGER) ||
        left.title.localeCompare(right.title)
      );
    });
  }, [
    state.corpus,
    state.activeClusterId,
    state.queryFilters,
    state.scopedCollectionId,
    state.savedCollections,
    hitRanks,
  ]);
  const wallOffset = () => {
    const page = scrollRef?.current;
    const wall = containerRef.current;
    return page && wall
      ? wall.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop
      : 0;
  };
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const scrollElement = scrollRef?.current ?? element;
    const update = () => {
      const width = element.clientWidth;
      const height = scrollElement.clientHeight;
      // Hidden views report zero size; retain the wall's geometry and scroll range.
      if (width <= 0 || height <= 0) return;
      setViewport((current) => ({
        ...current,
        width,
        height,
        scrollTop: scrollRef ? Math.max(0, scrollElement.scrollTop - wallOffset()) : current.scrollTop,
      }));
    };
    const onScroll = () => {
      scrollPositionRef.current = scrollElement.scrollTop;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (scrollElement !== element) observer.observe(scrollElement);
    scrollElement.addEventListener?.('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      scrollElement.removeEventListener?.('scroll', onScroll);
      cancelAnimationFrame(frameRef.current);
    };
  }, [scrollRef]);
  useEffect(() => {
    const element = scrollRef?.current ?? containerRef.current;
    if (!element) return;
    element.scrollTop = positions.get(positionKey) ?? 0;
    scrollPositionRef.current = element.scrollTop;
    setViewport((current) => ({ ...current, scrollTop: Math.max(0, element.scrollTop - wallOffset()) }));
    return () => {
      cancelAnimationFrame(frameRef.current);
      positions.delete(positionKey);
      positions.set(positionKey, scrollPositionRef.current);
      if (positions.size > 16) positions.delete(positions.keys().next().value);
    };
  }, [positionKey]);

  const columns =
    viewport.width >= 1200
      ? 5
      : viewport.width >= 980
        ? 4
        : viewport.width >= 620
          ? 3
          : 2;
  const gap = viewport.width < 620 ? 10 : 18;
  const cardWidth = Math.max(
    1,
    (viewport.width - gap * (columns - 1)) / columns,
  );
  const imageHeight = cardWidth * 1.25;
  const rowHeight = imageHeight + gap;
  const rowCount = Math.ceil(items.length / columns);
  const { start: startIndex, end: endIndex } = wallWindow(
    items.length,
    columns,
    rowHeight,
    viewport.height,
    viewport.scrollTop,
  );
  const visible = items.slice(startIndex, endIndex);

  return (
    <section
      ref={containerRef}
      className={`needle-wall${scrollRef ? ' needle-wall--page-scroll' : ''}`}
      aria-label={`Collection wall with ${items.length.toLocaleString()} image-backed artworks`}
      onScroll={(event) => {
        const scrollTop = event.currentTarget.scrollTop;
        scrollPositionRef.current = scrollTop;
        cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame(() =>
          setViewport((current) => ({ ...current, scrollTop })),
        );
      }}
      onKeyDown={(event) => {
        const index = Number(
          event.target.closest("[data-index]")?.dataset.index,
        );
        if (!Number.isFinite(index)) return;
        const delta =
          event.key === "ArrowRight"
            ? 1
            : event.key === "ArrowLeft"
              ? -1
              : event.key === "ArrowDown"
                ? columns
                : event.key === "ArrowUp"
                  ? -columns
                  : event.key === "Tab"
                    ? event.shiftKey
                      ? -1
                      : 1
                    : 0;
        if (!delta) return;
        const next = index + delta;
        if (next < 0 || next >= items.length) return;
        event.preventDefault();
        const element = containerRef.current;
        const scrollElement = scrollRef?.current ?? element;
        if (!element) return;
        const top = Math.floor(next / columns) * rowHeight;
        if (
          top < viewport.scrollTop ||
          top + rowHeight > viewport.scrollTop + viewport.height
        ) {
          scrollElement.scrollTop = top + wallOffset();
          scrollPositionRef.current = scrollElement.scrollTop;
          setViewport((current) => ({ ...current, scrollTop: top }));
        }
        requestAnimationFrame(() =>
          element
            .querySelector(`[data-index="${next}"]`)
            ?.focus({ preventScroll: true }),
        );
      }}
    >
      <div
        className="needle-wall__stage"
        style={{
          height: `${Math.max(viewport.height, rowCount * rowHeight - (rowCount ? gap : 0))}px`,
        }}
      >
        {visible.map((artwork, localIndex) => {
          const index = startIndex + localIndex;
          const column = index % columns;
          const row = Math.floor(index / columns);
          const rank = hitRanks.get(artwork.id);
          const selected = state.selectedArtworkId === artwork.id;
          return (
            <button
              type="button"
              data-artwork-id={artwork.id}
              data-index={index}
              className={`needle-artwork${selected ? " is-selected" : ""}${rank ? " is-result" : ""}`}
              key={artwork.id}
              style={{
                width: `${cardWidth}px`,
                height: `${imageHeight}px`,
                transform: `translate3d(${column * (cardWidth + gap)}px, ${row * rowHeight}px, 0)`,
              }}
              onClick={() => {
                runtime.selectArtwork(artwork.id);
                onOpen?.(artwork.id);
              }}
              aria-label={`${artwork.title} by ${artwork.creator}${rank ? `, result ${rank}` : ""}`}
            >
              <ArtworkImage
                src={artwork.thumbnailUrl ?? artwork.imageUrl}
                fallbackSrc={artwork.thumbnailFallbackUrls?.[0]}
                alt={artwork.title}
                eager={row === Math.floor(viewport.scrollTop / rowHeight)}
                priority={index < 2 && viewport.scrollTop === 0}
                sizes={`${Math.round(cardWidth)}px`}
                width={artwork.imageWidth}
                height={artwork.imageHeight}
                dominantColor={artwork.dominantColor}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
