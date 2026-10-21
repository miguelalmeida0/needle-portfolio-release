import {
  React,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "../../dist/modules/apps/web/src/shared/react.js";
import {
  useAppRuntime,
  useGalleryState,
} from "../../dist/modules/apps/web/src/app/app.context.js";
import {
  matchesQueryFilters,
  scopedCorpusItems,
  visibleHits,
} from "../../dist/modules/apps/web/src/app/app.selectors.js";
import { visibleArtworkNodes } from "../../dist/modules/apps/web/src/features/map/map-visibility.js";
import { ArtworkImage } from "../../dist/modules/apps/web/src/shared/ui/ArtworkImage.js";
import { Icon } from "../../dist/modules/apps/web/src/shared/icons.js";

// Presentation only: production selectors still decide membership, match rank,
// saved scope and filters. The semantic renderer remains available in Search tools.
export function CategoryMap({ onOpen }) {
  const runtime = useAppRuntime();
  const state = useGalleryState();
  const viewportRef = useRef(null);
  const [compact, setCompact] = useState(() => window.innerWidth < 620);
  const [zoom, setZoom] = useState(1);
  const [fullscreenError, setFullscreenError] = useState("");
  const hits = visibleHits(state);
  const items = scopedCorpusItems(state);
  const hitRanks = useMemo(
    () => new Map(hits.map((hit) => [hit.id, hit.rank])),
    [hits],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 619px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const groups = useMemo(() => {
    const nodes = visibleArtworkNodes({
      items,
      hits,
      visitedIds: state.approximate?.trace.visitedIds ?? [],
      selectedId: state.selectedArtworkId,
      // This map has no separate query node; retain every scoped match.
      queryId: null,
      view: "space",
      previewLimit: compact ? 72 : 120,
    });
    const grouped = new Map();
    for (const item of nodes) {
      const group = grouped.get(item.clusterId) ?? [];
      group.push(item);
      grouped.set(item.clusterId, group);
    }
    return (state.corpus?.clusters ?? []).flatMap((cluster) => {
      const artworks = grouped.get(cluster.id);
      return artworks?.length ? [{ ...cluster, artworks }] : [];
    });
  }, [
    items,
    hits,
    state.approximate,
    state.selectedArtworkId,
    state.corpus,
    compact,
  ]);

  const resize = (delta) =>
    setZoom((current) =>
      Math.max(0.8, Math.min(1.4, Math.round((current + delta) * 10) / 10)),
    );
  const reset = () => {
    setZoom(1);
    viewportRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };
  const toggleFullscreen = async () => {
    const element = viewportRef.current;
    if (!element) return;
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (element.requestFullscreen) await element.requestFullscreen();
      else setFullscreenError("Fullscreen is unavailable in this browser.");
    } catch {
      setFullscreenError("Fullscreen is unavailable in this browser.");
    }
  };

  return (
    <section
      className="needle-map"
      ref={viewportRef}
      aria-label="Artwork category map"
      style={{ "--map-zoom": zoom }}
    >
      <div className="needle-map__legend">
        <span>
          <i aria-hidden="true" /> Search matches
        </span>
        <span>Alongside the collection</span>
        {state.activeClusterId && (
          <button type="button" onClick={() => runtime.setClusterFilter(null)}>
            All categories <Icon name="close" size={12} />
          </button>
        )}
      </div>
      {groups.length ? (
        <div className="needle-map__groups">
          {groups.map((cluster) => (
            <section
              className={`needle-map__group${state.activeClusterId && state.activeClusterId !== cluster.id ? " is-muted" : ""}`}
              key={cluster.id}
              aria-labelledby={`map-category-${cluster.id}`}
            >
              <div className="needle-map__images">
                {cluster.artworks.map((artwork) => {
                  const rank = hitRanks.get(artwork.id);
                  const dimmed = Boolean(
                    (state.activeClusterId &&
                      state.activeClusterId !== artwork.clusterId) ||
                      !matchesQueryFilters(artwork, state.queryFilters),
                  );
                  return (
                    <button
                      type="button"
                      key={artwork.id}
                      data-artwork-id={artwork.id}
                      className={`needle-map__artwork${rank != null ? " is-match" : ""}${dimmed ? " is-dimmed" : ""}`}
                      aria-label={`${artwork.title} by ${artwork.creator}, ${artwork.clusterLabel}${rank != null ? `, result ${rank}` : ""}`}
                      aria-pressed={state.selectedArtworkId === artwork.id}
                      onClick={() => {
                        runtime.selectArtwork(artwork.id);
                        onOpen?.(artwork.id);
                      }}
                    >
                      <ArtworkImage
                        src={artwork.thumbnailUrl ?? artwork.imageUrl}
                        fallbackSrc={artwork.thumbnailFallbackUrls?.[0]}
                        alt=""
                        eager={rank != null}
                        priority={rank === 1}
                        sizes={`${Math.ceil((compact ? (rank != null ? 60 : 56) : rank != null ? 90 : 82) * zoom)}px`}
                        fallbackLabel="Met"
                        width={artwork.imageWidth}
                        height={artwork.imageHeight}
                        dominantColor={artwork.dominantColor}
                      />
                    </button>
                  );
                })}
              </div>
              <h2 id={`map-category-${cluster.id}`}>
                <button
                  type="button"
                  aria-pressed={state.activeClusterId === cluster.id}
                  onClick={() =>
                    runtime.setClusterFilter(
                      state.activeClusterId === cluster.id ? null : cluster.id,
                    )
                  }
                >
                  {cluster.label}
                </button>
              </h2>
            </section>
          ))}
        </div>
      ) : (
        <p className="needle-map__empty" role="status">
          {state.status === 'booting' ? 'Opening the collection…' : 'No artworks in this collection yet.'}
        </p>
      )}
      <div className="needle-map__controls" aria-label="Map controls">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= 0.8}
          onClick={() => resize(-0.1)}
        >
          <Icon name="minus" size={16} />
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= 1.4}
          onClick={() => resize(0.1)}
        >
          <Icon name="plus" size={16} />
        </button>
        <button type="button" aria-label="Center map" onClick={reset}>
          <Icon name="target" size={16} />
        </button>
        <button
          type="button"
          aria-label="Toggle fullscreen"
          onClick={toggleFullscreen}
        >
          <Icon name="expand" size={16} />
        </button>
      </div>
      {fullscreenError && (
        <p className="needle-map__notice" role="status">
          {fullscreenError}
        </p>
      )}
    </section>
  );
}
