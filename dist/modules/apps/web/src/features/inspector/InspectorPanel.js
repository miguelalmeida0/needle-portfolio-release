import { React, useRef } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
import { compareArtworks, queryArtwork, selectedArtwork, selectedHit, selectedMatchEvidence, selectedSimilarity } from '../../app/app.selectors.js';
import { ComparePanel } from '../compare/ComparePanel.js';
function artworkSummary(creator, objectDate, year) {
    const maker = creator || 'Unknown maker';
    const date = objectDate || (year === null ? 'Date unknown' : String(year));
    return `${maker} · ${date}`;
}
export function InspectorPanel() {
    const runtime = useAppRuntime();
    const compareTrigger = useRef(null);
    const state = useAppState();
    const selected = selectedArtwork(state);
    const query = queryArtwork(state);
    const artwork = selected ?? query;
    const evidence = selectedMatchEvidence(state);
    const isCurrentMatch = Boolean(selectedHit(state));
    const similarity = selectedSimilarity(state);
    const comparing = compareArtworks(state).length >= 2;
    if (!artwork) {
        return (React.createElement("aside", { className: "inspector-panel inspector-panel--empty", "aria-label": "Search inspector" },
            React.createElement("div", { className: "inspector-panel__header" },
                React.createElement("span", null, "Inspector")),
            React.createElement("p", null, "Select an artwork to refine the search.")));
    }
    const inCollections = state.savedCollections.filter((collection) => collection.artworkIds.includes(artwork.id));
    return (React.createElement("aside", { className: "inspector-panel", "aria-label": "Search inspector" },
        React.createElement("div", { className: "inspector-panel__header" },
            React.createElement("span", null, "Inspector"),
            React.createElement("a", { href: artwork.objectUrl, target: "_blank", rel: "noreferrer", "aria-label": "Open the Met source record" },
                React.createElement(Icon, { name: "external", size: 14 }))),
        React.createElement("div", { className: "inspector-preview inspector-preview--hero" },
            React.createElement(ArtworkImage, { src: artwork.detailImageUrl ?? artwork.imageUrl ?? artwork.thumbnailUrl, alt: artwork.title, role: "detail", sizes: "(max-width: 900px) 90vw, 280px", fallbackSrc: artwork.thumbnailUrl, fallbackLabel: "Artwork", width: artwork.imageWidth, height: artwork.imageHeight, dominantColor: artwork.dominantColor })),
        React.createElement("div", { className: "inspector-copy inspector-copy--artwork" },
            React.createElement("h2", null, artwork.title),
            React.createElement("p", null, artworkSummary(artwork.creator, artwork.objectDate, artwork.year)),
            React.createElement("span", null, artwork.department || 'The Metropolitan Museum of Art')),
        React.createElement("div", { className: "inspector-action-list", "aria-label": "Refine from this artwork" },
            runtime.experimentalVisual && React.createElement(React.Fragment, null,
                React.createElement("button", { type: "button", onClick: () => void runtime.moreLike(artwork.id) },
                    React.createElement(Icon, { name: "spark", size: 16 }),
                    React.createElement("span", null, "More like this")),
                React.createElement("button", { type: "button", onClick: () => void runtime.lessLike(artwork.id) },
                    React.createElement(Icon, { name: "circle-minus", size: 16 }),
                    React.createElement("span", null, "Less like this")),
                React.createElement("button", { type: "button", onClick: () => void runtime.pinToQuery(artwork.id) },
                    React.createElement(Icon, { name: "pin", size: 16 }),
                    React.createElement("span", null, "Pin to query"))),
            React.createElement("button", { ref: compareTrigger, type: "button", onClick: () => runtime.compareArtwork(artwork.id), className: comparing ? 'is-active' : '' },
                React.createElement(Icon, { name: "compare", size: 16 }),
                React.createElement("span", null, "Compare"))),
        React.createElement(ComparePanel, { onClose: () => compareTrigger.current?.focus({ preventScroll: true }) }),
        runtime.experimentalVisual && React.createElement("section", { className: "inspector-detail-search", "aria-labelledby": "detail-search-title" },
            React.createElement("div", { className: "inspector-section-title" },
                React.createElement("h3", { id: "detail-search-title" }, "Search this detail")),
            React.createElement("button", { type: "button", onClick: () => runtime.openDetailSearch(artwork.id) },
                React.createElement("span", { className: "inspector-detail-search__thumb" },
                    React.createElement(ArtworkImage, { src: artwork.thumbnailUrl ?? artwork.imageUrl, alt: "", width: artwork.imageWidth, height: artwork.imageHeight, dominantColor: artwork.dominantColor })),
                React.createElement("span", null,
                    React.createElement("strong", null, "Search visually similar"),
                    React.createElement("small", null, "Use a selected area from this artwork.")),
                React.createElement(Icon, { name: "arrow-right", size: 16 }))),
        React.createElement("section", { className: "inspector-why", "aria-labelledby": "why-matched-title" },
            React.createElement("div", { className: "inspector-section-title" },
                React.createElement("h3", { id: "why-matched-title" }, isCurrentMatch ? 'Why this matched' : 'Artwork context'),
                similarity !== null && React.createElement("span", null, similarity.toFixed(3))),
            isCurrentMatch ? React.createElement("ul", null, evidence.length > 0 ? evidence.map((reason) => React.createElement("li", { key: reason.id },
                React.createElement(Icon, { name: "check", size: 12 }),
                React.createElement("span", null, reason.label))) : React.createElement("li", null,
                React.createElement(Icon, { name: "check", size: 12 }),
                React.createElement("span", null, "Closest in the composed vector space"))) : React.createElement("p", null, "This artwork is outside the current results.")),
        React.createElement("details", { className: "inspector-details" },
            React.createElement("summary", null, "Artwork details"),
            React.createElement("dl", null,
                React.createElement("div", null,
                    React.createElement("dt", null, "Maker"),
                    React.createElement("dd", null, artwork.creator || 'Unknown maker')),
                React.createElement("div", null,
                    React.createElement("dt", null, "Date"),
                    React.createElement("dd", null, artwork.objectDate || artwork.year || 'Unknown')),
                React.createElement("div", null,
                    React.createElement("dt", null, "Medium"),
                    React.createElement("dd", null, artwork.medium || artwork.classification || 'Not recorded')),
                React.createElement("div", null,
                    React.createElement("dt", null, "Culture"),
                    React.createElement("dd", null, artwork.culture || artwork.period || 'Not recorded')))),
        React.createElement("section", { className: "inspector-collections", "aria-labelledby": "inspector-collections-title" },
            React.createElement("div", { className: "inspector-section-title" },
                React.createElement("h3", { id: "inspector-collections-title" }, "Collections")),
            React.createElement("div", { className: "inspector-collections__list" },
                state.savedCollections.slice(0, 3).map((collection) => {
                    const contained = collection.artworkIds.includes(artwork.id);
                    return (React.createElement("button", { type: "button", key: collection.id, onClick: () => void runtime.addArtworkToCollection(collection.id, artwork.id), className: contained ? 'is-contained' : '' },
                        React.createElement("span", { className: "saved-collection__swatch", style: { backgroundColor: collection.color } }),
                        React.createElement("span", null, collection.name),
                        contained ? React.createElement(Icon, { name: "check", size: 13 }) : React.createElement(Icon, { name: "plus", size: 13 })));
                }),
                state.savedCollections.length === 0 && (React.createElement("button", { type: "button", onClick: () => void runtime.createCollectionFromArtwork(artwork.id) },
                    React.createElement(Icon, { name: "folder", size: 14 }),
                    React.createElement("span", null, "Create a collection"),
                    React.createElement(Icon, { name: "plus", size: 13 })))),
            inCollections.length > 0 && React.createElement("p", null, inCollections.length === 1 ? 'Saved in 1 collection' : `Saved in ${inCollections.length} collections`))));
}
//# sourceMappingURL=InspectorPanel.js.map