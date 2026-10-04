import { React, useEffect, useMemo, useRef, useState } from '../../shared/react.js';
import { createSpatialRenderer } from '../../../../../packages/renderer/src/index.js';
import { useAppRuntime, useGalleryState } from '../../app/app.context.js';
import { featuredTextMatch, matchesQueryFilters, missedExactIds, queryArtwork, queryResultLabel, scopedCorpusItems, visibleHits } from '../../app/app.selectors.js';
import { ArtworkNode } from './ArtworkNode.js';
import { FeaturedMatchNode } from './FeaturedMatchNode.js';
import { ClusterContours } from './ClusterContours.js';
import { ClusterLabels } from './ClusterLabels.js';
import { MapControls } from './MapControls.js';
import { QueryNode } from './QueryNode.js';
import { buildDisplayCoordinates } from './map-layout.js';
import { buildAmbientPoints, buildConnections } from './map-scene.js';
import { visibleArtworkNodes } from './map-visibility.js';
export function SpatialMap() {
    const runtime = useAppRuntime();
    const state = useGalleryState();
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const [size, setSize] = useState({ width: 900, height: 680 });
    const [camera, setCamera] = useState({ scale: 1, x: 0, y: 0 });
    const dragRef = useRef(null);
    const hits = visibleHits(state);
    const hitRanks = useMemo(() => new Map(hits.map((hit) => [hit.id, hit.rank])), [hits]);
    const missed = missedExactIds(state);
    const visited = useMemo(() => new Set(state.approximate?.trace.visitedIds ?? []), [state.approximate]);
    const query = queryArtwork(state);
    const featuredMatch = featuredTextMatch(state);
    const items = scopedCorpusItems(state);
    const packPreviewLimit = state.corpus?.source.previewImageCount ?? Math.min(96, items.length);
    const previewLimit = Math.min(packPreviewLimit, size.width < 620 ? 28 : size.width < 980 ? 44 : 64);
    const domItems = useMemo(() => visibleArtworkNodes({
        items,
        hits,
        visitedIds: state.approximate?.trace.visitedIds ?? [],
        selectedId: state.selectedArtworkId,
        queryId: query?.id ?? null,
        view: state.mapView,
        previewLimit
    }).filter((item) => item.id !== featuredMatch?.id), [items, hits, state.approximate, state.selectedArtworkId, query, state.mapView, previewLimit, featuredMatch]);
    const clusters = state.corpus?.clusters ?? [];
    const displayCoordinates = useMemo(() => buildDisplayCoordinates(items, hits, state.mapView), [items, hits, state.mapView]);
    const ambientPoints = useMemo(() => state.mapView === 'space' ? buildAmbientPoints(clusters) : [], [clusters, state.mapView]);
    const connections = useMemo(() => buildConnections(items, hits, state.approximate?.trace.edges ?? [], displayCoordinates, featuredMatch?.id ?? null), [items, hits, state.approximate, displayCoordinates, featuredMatch]);
    const labelResultCoordinates = useMemo(() => hits
        .filter((hit) => hit.id !== featuredMatch?.id)
        .slice(0, 8)
        .map((hit) => displayCoordinates.get(hit.id))
        .filter((coordinate) => Boolean(coordinate)), [hits, featuredMatch, displayCoordinates]);
    useEffect(() => {
        const element = containerRef.current;
        if (!element)
            return undefined;
        const update = () => {
            const rect = element.getBoundingClientRect();
            setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return undefined;
        let cancelled = false;
        void createSpatialRenderer(canvas).then((renderer) => {
            if (cancelled) {
                renderer.destroy();
                return;
            }
            rendererRef.current = renderer;
            runtime.setRendererKind(renderer.kind);
        });
        return () => {
            cancelled = true;
            rendererRef.current?.destroy();
            rendererRef.current = null;
        };
    }, [runtime]);
    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer)
            return;
        const itemPoints = items.map((item) => {
            const coordinate = displayCoordinates.get(item.id) ?? { x: item.x, y: item.y };
            return {
                id: item.id,
                x: coordinate.x,
                y: coordinate.y,
                clusterColor: item.clusterColor,
                highlighted: hitRanks.has(item.id),
                visited: visited.has(item.id)
            };
        });
        const scene = {
            selectionColor: getComputedStyle(containerRef.current).getPropertyValue('--selection').trim(),
            width: size.width,
            height: size.height,
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            points: [...ambientPoints, ...itemPoints],
            connections
        };
        renderer.render(scene);
    }, [size, items, displayCoordinates, hitRanks, visited, ambientPoints, connections, state.rendererKind]);
    useEffect(() => {
        if (state.mapView === 'focus')
            setCamera({ scale: 1, x: 0, y: 0 });
    }, [state.mapView]);
    const zoom = (delta) => setCamera((current) => ({ ...current, scale: Math.max(0.78, Math.min(1.75, current.scale + delta)) }));
    const reset = () => setCamera({ scale: 1, x: 0, y: 0 });
    const toggleFullscreen = () => {
        const element = containerRef.current;
        if (!element)
            return;
        if (document.fullscreenElement)
            void document.exitFullscreen();
        else
            void element.requestFullscreen?.();
    };
    const onPointerDown = (event) => {
        if (event.target.closest('button') || state.mapView === 'focus')
            return;
        dragRef.current = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag)
            return;
        setCamera((current) => ({ ...current, x: drag.cameraX + event.clientX - drag.x, y: drag.cameraY + event.clientY - drag.y }));
    };
    const onPointerUp = () => { dragRef.current = null; };
    const onWheel = (event) => {
        if (state.mapView === 'focus')
            return;
        if (event.ctrlKey || Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.preventDefault();
            zoom(event.deltaY > 0 ? -0.08 : 0.08);
        }
    };
    const planeStyle = { transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` };
    const busy = state.status === 'searching' || state.status === 'truth-checking' || state.status === 'probing';
    return (React.createElement("section", { className: `spatial-map spatial-map--${state.mapView}`, ref: containerRef, "aria-label": "Semantic vector map", onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp, onWheel: onWheel },
        React.createElement("div", { className: "map-plane", style: planeStyle },
            React.createElement("canvas", { className: "map-canvas", ref: canvasRef }),
            React.createElement(ClusterContours, { clusters: clusters, activeClusterId: state.activeClusterId }),
            React.createElement(ClusterLabels, { clusters: clusters, activeClusterId: state.activeClusterId, width: size.width, height: size.height, featuredMatch: Boolean(featuredMatch), queryNode: !featuredMatch, resultCoordinates: labelResultCoordinates, onSelect: (clusterId) => runtime.setClusterFilter(clusterId) }),
            React.createElement("div", { className: "map-artworks" },
                domItems.map((item) => {
                    const rank = hitRanks.get(item.id) ?? null;
                    const coordinate = displayCoordinates.get(item.id) ?? { x: item.x, y: item.y };
                    return (React.createElement(ArtworkNode, { key: item.id, artwork: item, x: coordinate.x * size.width, y: coordinate.y * size.height, selected: state.selectedArtworkId === item.id, matched: rank !== null, missed: missed.has(item.id), visited: visited.has(item.id), dimmed: Boolean((state.activeClusterId && state.activeClusterId !== item.clusterId) || (state.queryFilters.length > 0 && !matchesQueryFilters(item, state.queryFilters))), rank: rank, onSelect: () => runtime.selectArtwork(item.id) }));
                }),
                !featuredMatch && (React.createElement(QueryNode, { artwork: query, uploadedPreviewUrl: state.uploadedPreviewUrl, queryText: state.activeQuery, busy: busy, onSelect: () => runtime.selectArtwork(query?.id ?? null) }))),
            featuredMatch && (React.createElement("div", { className: "map-featured-layer" },
                React.createElement(FeaturedMatchNode, { key: `${state.resultMode}:${state.activeQuery}:${featuredMatch.id}`, artwork: featuredMatch, queryText: state.activeQuery, label: queryResultLabel(state), selected: state.selectedArtworkId === featuredMatch.id, onSelect: () => runtime.selectArtwork(featuredMatch.id) })))),
        React.createElement("div", { className: "map-caption", "aria-live": "polite" },
            React.createElement("span", { className: `map-caption__status map-caption__status--${state.rendererKind}` }),
            React.createElement("span", null,
                state.rendererKind === 'webgpu' ? 'WebGPU' : state.rendererKind === 'canvas2d' ? 'Canvas' : 'Preparing',
                " \u00B7 ",
                items.length.toLocaleString(),
                " catalog records",
                state.queryTerms.some((term) => term.kind === 'image' || term.kind === 'detail') ? ` · ${state.visualIndexProgress.completed.toLocaleString()} visual candidates` : '',
                " \u00B7 ",
                state.approximate?.trace.edges.length ?? 0,
                " real traversal edges")),
        React.createElement(MapControls, { onZoomIn: () => zoom(.12), onZoomOut: () => zoom(-.12), onReset: reset, onExpand: toggleFullscreen })));
}
