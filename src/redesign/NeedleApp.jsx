import {
  React,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "../../dist/modules/apps/web/src/shared/react.js";
import {
  useAppRuntime,
  useAppState,
} from "../../dist/modules/apps/web/src/app/app.context.js";
import {
  artworkById,
  activeCollection,
  visibleHits,
} from "../../dist/modules/apps/web/src/app/app.selectors.js";
import { discoveryItems } from "../../dist/modules/apps/web/src/app/discovery.selectors.js";
import { LogoMark } from "../../dist/modules/apps/web/src/shared/ui/LogoMark.js";
import { Icon } from "../../dist/modules/apps/web/src/shared/icons.js";
import { ArtworkImage } from "./GalleryImage.jsx";
import { SearchComposer } from "../../dist/modules/apps/web/src/features/search/SearchComposer.js";
import { QueryCanvas } from "../../dist/modules/apps/web/src/features/query/QueryCanvas.js";
import { QueryFilterMenu } from "../../dist/modules/apps/web/src/features/query/QueryFilterMenu.js";
import { RecentQueries } from "../../dist/modules/apps/web/src/features/history/RecentQueries.js";
import { SavedCollections } from "../../dist/modules/apps/web/src/features/collections/SavedCollections.js";
import { InspectorPanel } from "../../dist/modules/apps/web/src/features/inspector/InspectorPanel.js";
import { AccuracyControl } from "../../dist/modules/apps/web/src/features/tuning/AccuracyControl.js";
import { TruthLens } from "../../dist/modules/apps/web/src/features/truth/TruthLens.js";
import { MapToolbar } from "../../dist/modules/apps/web/src/features/topbar/MapToolbar.js";
import { SpatialMap } from "../../dist/modules/apps/web/src/features/map/SpatialMap.js";
import { FeedbackToast } from "../../dist/modules/apps/web/src/shared/ui/FeedbackToast.js";
import {
  backLabel,
  createNavigation,
  isSearchSubmission,
} from "./navigation.mjs";
import { CollectionWall } from "./CollectionWall.jsx";
import { CategoryMap } from "./CategoryMap.jsx";
import { mapArtworks } from "./map-artworks.mjs";

const DetailSearchOverlay = React.lazy(() =>
  import(
    "../../dist/modules/apps/web/src/features/detail/DetailSearchOverlay.js"
  ).then((module) => ({ default: module.DetailSearchOverlay })),
);
const examples = [
  "Something small and golden",
  "Ruins after a fire",
  "A room with a window",
];
const Arrow = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <path d="M20 12H4m6-6-6 6 6 6" />
  </svg>
);

export function NeedleApp() {
  const runtime = useAppRuntime();
  const state = useAppState();
  const [navigation] = useState(() =>
    createNavigation(window.history, window.location),
  );
  const [route, setRoute] = useState(navigation.current);
  const [visited, setVisited] = useState(() => new Set([route.view]));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const root = useRef(null),
    header = useRef(null),
    pages = useRef(null),
    resultsViewport = useRef(null),
    slot = useRef(null),
    search = useRef(null),
    filter = useRef(null);
  const composing = useRef(false),
    keyboard = useRef(false),
    returnFocus = useRef(null),
    transition = useRef(null),
    inspectedRoute = useRef(null),
    recommendationOrigin = useRef(null);
  const home = route.view === "home";
  const hasResults =
    visited.has("results") ||
    visited.has("map") ||
    visited.has("advanced") ||
    Boolean(route.backView && route.backView !== "home");
  const hits = visibleHits(state);
  const preview = useMemo(() => mapArtworks(state, 12).slice(0, 12), [
    state.corpus, state.approximate, state.exact, state.resultMode,
    state.selectedArtworkId, state.scopedCollectionId, state.savedCollections,
  ]);
  const collection = activeCollection(state);
  const render = (next, animate = false) => {
    const update = () => {
      setRoute(next);
      setVisited((previous) => new Set([...previous, next.view]));
    };
    transition.current?.skipTransition();
    if (
      animate &&
      !keyboard.current &&
      document.startViewTransition &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      transition.current = document.startViewTransition(() =>
        window.SHAP.ReactDOM.flushSync(update),
      );
    } else update();
  };
  const go = (changes, replace = false) =>
    render(
      navigation.visit(changes, replace),
      changes.view && changes.view !== route.view,
    );
  const back = () => {
    const fallback = navigation.back();
    if (fallback) render(fallback);
  };
  const open = (overlay) => {
    returnFocus.current = document.activeElement;
    if (overlay === "tools") recommendationOrigin.current = null;
    go({ overlay });
  };
  const openArtwork = (id, fromRecommendations = false) => {
    const artworkId =
      typeof id === "string"
        ? id
        : runtime.store.getSnapshot().selectedArtworkId;
    if (!artworkId) return;
    returnFocus.current = document.activeElement;
    if (fromRecommendations) recommendationOrigin.current = artworkId;
    go({ overlay: "artwork", artworkId, fromRecommendations });
  };
  const close = (event) => {
    event?.preventDefault();
    back();
  };
  const results = () => go({ view: "results", overlay: null });
  const returnToResults = () => {
    if (!hasResults) {
      search.current?.querySelector("input")?.focus();
    } else if (
      route.view !== "results" &&
      route.backView === "results" &&
      !route.overlay
    ) {
      back();
    } else if (route.view === "results" && !route.overlay) {
      document
        .getElementById("needle-results-title")
        ?.focus({ preventScroll: true });
    } else results();
  };
  // Capture presentation intent only. The deployed Composer remains the sole
  // owner of IME handling, instant previews and explicit history submission.
  const submitted = () => {
    if (state.draftQuery.trim()) queueMicrotask(results);
  };
  useEffect(() => {
    const pop = (event) => render(navigation.restore(event.state));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [navigation]);
  useLayoutEffect(() => {
    if (!home || !slot.current) return;
    const measure = () => {
      const rect = slot.current.getBoundingClientRect();
      for (const [name, value] of Object.entries({
        top: rect.top,
        left: rect.left,
        width: rect.width,
      }))
        root.current.style.setProperty(
          `--needle-home-search-${name}`,
          `${value}px`,
        );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [home]);
  useLayoutEffect(() => {
    if (route.overlay !== "artwork") {
      inspectedRoute.current = null;
      return;
    }
    // Startup's default search may select its first result. Restore the history
    // target after it settles, once per route, without constraining inspector actions.
    if (
      state.status !== "ready" ||
      inspectedRoute.current === route ||
      !artworkById(state, route.artworkId)
    )
      return;
    inspectedRoute.current = route;
    if (state.selectedArtworkId !== route.artworkId)
      runtime.selectArtwork(route.artworkId);
  }, [route, state.corpus, state.status, runtime]);
  useLayoutEffect(() => {
    // Update inert before the following focus restoration effect.
    const inert = route.overlay === "tools";
    if (header.current) header.current.inert = inert;
    if (pages.current) pages.current.inert = inert;
    return () => {
      if (header.current) header.current.inert = false;
      if (pages.current) pages.current.inert = false;
    };
  }, [route.overlay]);
  useLayoutEffect(() => {
    if (route.overlay) return;
    if (returnFocus.current?.isConnected) {
      returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    } else if (home)
      search.current?.querySelector("input")?.focus({ preventScroll: true });
    else
      document
        .getElementById(`needle-${route.view}-title`)
        ?.focus({ preventScroll: true });
  }, [route.view, route.overlay]);
  const explicitCapture = (event) => {
    if (isSearchSubmission(event, state.draftQuery, composing.current))
      submitted();
  };
  const exampleSearch = (text) => {
    runtime.setDraft(text);
    void runtime.submitDraft();
    results();
  };
  return (
    <div
      ref={root}
      className={`needle-app is-${route.view}`}
      onKeyDownCapture={() => {
        keyboard.current = true;
      }}
      onPointerDownCapture={() => {
        keyboard.current = false;
      }}
    >
      <a className="needle-skip" href="#needle-main">
        Skip to collection
      </a>
      <header ref={header} className="needle-header">
        <button
          className="needle-brand"
          aria-label={hasResults ? "Needle — return to results" : "Needle"}
          onClick={returnToResults}
        >
          <LogoMark size={28} />
          <span>Needle</span>
        </button>
        <div
          ref={search}
          className="needle-search"
          role="search"
          aria-label="Search the art collection"
          onClickCapture={explicitCapture}
          onKeyDownCapture={explicitCapture}
          onCompositionStartCapture={() => {
            composing.current = true;
          }}
          onCompositionEndCapture={() => {
            composing.current = false;
          }}
        >
          <SearchComposer />
        </div>
        <div className="needle-actions">
          <button onClick={() => open("saved")}>
            <Icon name="bookmark" size={17} />
            <span>Saved</span>
          </button>
          {!home && (
            <button onClick={() => open("tools")} aria-label="Search tools">
              <Icon name="settings" size={17} />
              <span>Search tools</span>
            </button>
          )}
        </div>
      </header>
      <div ref={pages} id="needle-main" className="needle-pages">
        {!home && (
          <nav className="needle-navigation" aria-label="Page navigation">
            <button onClick={back}>
              <Arrow />
              Back to {backLabel(route)}
            </button>
            <button
              onClick={() => {
                go({ view: "home", overlay: null });
                requestAnimationFrame(() =>
                  search.current?.querySelector("input")?.select(),
                );
              }}
            >
              New search
            </button>
          </nav>
        )}
        {home && (
          <main className="needle-home">
            <HomeBackdrop items={state.corpus?.items ?? []} />
            <section className="needle-home-panel">
              <h1>What would you like to see?</h1>
              <p>
                Describe a picture in your own words. Needle finds it by what’s
                in it, not by its catalogue title.
              </p>
              <div ref={slot} className="needle-home-search-slot" />
              <div className="needle-examples">
                <p>Or try one</p>
                <div>
                  {examples.map((text) => (
                    <button key={text} onClick={() => exampleSearch(text)}>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
              {hasResults && (
                <button className="needle-resume" onClick={results}>
                  Return to your results <Icon name="arrow-right" size={16} />
                </button>
              )}
            </section>
          </main>
        )}
        {visited.has("results") && (
          <main ref={resultsViewport} className="needle-results" hidden={route.view !== "results"}>
            <div className="needle-results-summary">
              <div>
                <p>{collection?.name || "From The Met collection"}</p>
                <h1 id="needle-results-title" tabIndex={-1}>
                  {state.activeQuery || "The collection"}
                </h1>
                <div className="needle-result-actions">
                  <button
                    ref={filter}
                    onClick={() => setFiltersOpen((value) => !value)}
                    aria-expanded={filtersOpen}
                  >
                    <Icon name="filter" size={15} />
                    Filters
                    {state.queryFilters.length
                      ? ` · ${state.queryFilters.length}`
                      : ""}
                  </button>
                  {state.queryFilters.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void runtime.removeFilter(item.id)}
                      aria-label={`Remove ${item.label}`}
                    >
                      {item.label}
                      <Icon name="close" size={13} />
                    </button>
                  ))}
                  {state.activeClusterId && (
                    <button onClick={() => runtime.setClusterFilter(null)}>
                      All categories <Icon name="close" size={13} />
                    </button>
                  )}
                  {state.scopedCollectionId && (
                    <button onClick={() => void runtime.scopeCollection(null)}>
                      Entire collection <Icon name="close" size={13} />
                    </button>
                  )}
                </div>
              </div>
              {preview.length > 0 && <div className="needle-map-preview">
                <button
                  className="needle-minimap"
                  aria-label="Open the artwork map"
                  onClick={() => go({ view: "map" })}
                >
                  {preview.map((item) => (
                    <ArtworkImage
                      key={item.id}
                      src={item.thumbnailUrl || item.imageUrl}
                      fallbackSrc={item.thumbnailFallbackUrls?.[0]}
                      alt=""
                      width={item.imageWidth}
                      height={item.imageHeight}
                      sizes="48px"
                    />
                  ))}
                </button>
                <button
                  className="needle-map-action"
                  onClick={() => go({ view: "map" })}
                >
                  See them on the map <Icon name="arrow-right" size={16} />
                </button>
              </div>}
            </div>
            <CollectionWall onOpen={openArtwork} scrollRef={resultsViewport} active={route.view === 'results'} />
          </main>
        )}
        {visited.has("map") && (
          <main className="needle-map-section" hidden={route.view !== "map"}>
            <h1 id="needle-map-title" className="needle-sr-only" tabIndex={-1}>
              Artworks by category
            </h1>
            <CategoryMap onOpen={openArtwork} active={route.view === 'map'} />
          </main>
        )}
        {visited.has("advanced") && (
          <main className="needle-advanced" hidden={route.view !== "advanced"}>
            <h1
              id="needle-advanced-title"
              className="needle-sr-only"
              tabIndex={-1}
            >
              Semantic artwork map
            </h1>
            <div
              className="needle-advanced-toolbar"
              onClick={(event) => {
                const option = event.target.closest('[role="menuitemradio"]');
                if (option?.textContent.startsWith("Collection wall"))
                  queueMicrotask(results);
              }}
            >
              <MapToolbar />
            </div>
            <div
              onClick={(event) => {
                const artworkId =
                  event.target.closest("[data-artwork-id]")?.dataset
                    .artworkId ??
                  (event.target.closest(".query-node") && state.queryArtworkId);
                if (artworkId && artworkById(state, artworkId))
                  queueMicrotask(() => openArtwork(artworkId));
              }}
            >
              <SpatialMap />
            </div>
          </main>
        )}
      </div>
      {filtersOpen && (
        <QueryFilterMenu
          anchor={filter.current}
          onClose={() => setFiltersOpen(false)}
        />
      )}
      <NativeDialog
        open={route.overlay === "saved"}
        label="Saved collections"
        onClose={close}
      >
        <div
          onClick={(event) => {
            if (event.target.closest(".saved-collections__list button"))
              queueMicrotask(() =>
                go({ view: "results", overlay: null }, true),
              );
          }}
        >
          <SavedCollections />
        </div>
      </NativeDialog>
      <NativeDialog
        open={route.overlay === "artwork" && !state.detailSearchArtworkId}
        label="Artwork details"
        className="needle-art-dialog"
        onClose={close}
      >
        <InspectorPanel
          discoveryReturn={
            route.fromRecommendations &&
            state.selectedArtworkId === route.artworkId ? (
              <button className="discovery-return" onClick={back}>
                Back to recommendations
              </button>
            ) : null
          }
        />
      </NativeDialog>
      {route.overlay === "tools" && (
        <Tools
          onClose={close}
          onAdvanced={() => {
            if (state.mapView === "wall") runtime.setMapView("space");
            go({ view: "advanced", overlay: null }, true);
          }}
          onResults={() => go({ view: "results", overlay: null }, true)}
          onArtwork={(id) => openArtwork(id, true)}
          focusArtworkId={recommendationOrigin.current}
        />
      )}
      {runtime.experimentalVisual && state.detailSearchArtworkId && (
        <React.Suspense fallback={null}>
          <DetailSearchOverlay />
        </React.Suspense>
      )}
      {state.errorMessage && (
        <div className="needle-error" role="alert">
          <p>{state.errorMessage}</p>
          {state.status === "error" && (
            <button onClick={() => window.location.reload()}>
              Retry startup
            </button>
          )}
        </div>
      )}
      <span className="needle-sr-only" role="status">
        {state.status === "searching"
          ? "Finding artworks in the collection."
          : ""}
      </span>
      <FeedbackToast />
    </div>
  );
}

function NativeDialog({ open, label, onClose, className = "", children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (open && !ref.current.open) ref.current.showModal();
    else if (!open && ref.current.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`needle-dialog ${className}`}
      aria-label={label}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose(event);
      }}
    >
      <div className="needle-dialog-heading">
        <h2>{label}</h2>
        <button aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}

function Tools({ onClose, onAdvanced, onResults, onArtwork, focusArtworkId }) {
  const runtime = useAppRuntime(),
    state = useAppState(),
    ref = useRef(null);
  const recommendations = discoveryItems(state);
  useEffect(() => {
    const recommendation = [
      ...ref.current.querySelectorAll("[data-artwork-id]"),
    ].find((element) => element.dataset.artworkId === focusArtworkId);
    (recommendation ?? ref.current.querySelector("button"))?.focus();
    const key = (event) => {
      if (
        document.querySelector(".query-filter-menu") ||
        document.querySelector(".view-popover")
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const elements = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled),input,a[href],select,[tabindex="0"]',
          ),
        ].filter((element) => element.getClientRects().length);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return (
    <div
      className="needle-tools-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="needle-dialog needle-tools"
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
      >
        <div className="needle-dialog-heading">
          <h2>Search tools</h2>
          <button aria-label="Close search tools" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <QueryCanvas />
        <div className="needle-tool-actions">
          <button
            onClick={() => void runtime.branchCurrentSearch()}
            disabled={!state.queryTerms.length}
          >
            Branch search
          </button>
          <button
            onClick={() => void runtime.saveCurrentCollection()}
            disabled={!state.approximate}
          >
            Save collection
          </button>
          <button onClick={onAdvanced}>Explore semantic map</button>
        </div>
        <div
          onClick={(event) => {
            if (event.target.closest(".recent-query,.query-branches button"))
              queueMicrotask(onResults);
          }}
        >
          <RecentQueries />
        </div>
        {recommendations.length > 0 && (
          <section className="needle-recommendations">
            <h3>Recommended artworks</h3>
            {recommendations.map(({ artwork }) => (
              <button
                key={artwork.id}
                data-artwork-id={artwork.id}
                onClick={() => {
                  runtime.activateRecommendation(artwork.id);
                  onArtwork(artwork.id);
                }}
                aria-pressed={state.selectedArtworkId === artwork.id}
              >
                <ArtworkImage
                  src={artwork.thumbnailUrl || artwork.imageUrl}
                  fallbackSrc={artwork.thumbnailFallbackUrls?.[0]}
                  alt=""
                  width={artwork.imageWidth}
                  height={artwork.imageHeight}
                  sizes="56px"
                />
                <span>{artwork.title}</span>
              </button>
            ))}
          </section>
        )}
        <AccuracyControl />
        <TruthLens />
        <a
          href="https://www.metmuseum.org/hubs/open-access"
          target="_blank"
          rel="noreferrer"
        >
          The Met Open Access
        </a>
      </section>
    </div>
  );
}

function HomeBackdrop({ items }) {
  const artworks = useMemo(
    () =>
      items
        .filter((item) => item.previewRank != null && item.previewRank < 120)
        .slice(0, 12),
    [items],
  );
  return (
    <div className="needle-backdrop" aria-hidden="true">
      {artworks.map((item, index) => (
        <div
          key={item.id}
          style={{
            left: `${[7, 22, 39, 61, 79, 91, 8, 24, 40, 61, 78, 92][index]}%`,
            top: `${index < 6 ? 14 + (index % 3) * 6 : 72 + (index % 3) * 5}%`,
          }}
        >
          <ArtworkImage
            src={item.thumbnailUrl || item.imageUrl}
            fallbackSrc={item.thumbnailFallbackUrls?.[0]}
            alt=""
            width={item.imageWidth}
            height={item.imageHeight}
            sizes="72px"
          />
        </div>
      ))}
    </div>
  );
}
