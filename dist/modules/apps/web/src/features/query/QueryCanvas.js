import { React, useRef, useState } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
import { artworkById, queryScopeDescription } from '../../app/app.selectors.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
import { QueryFilterMenu } from './QueryFilterMenu.js';
export function QueryCanvas() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const fileRef = useRef(null);
    const filterRef = useRef(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    return (React.createElement("section", { className: "query-canvas", "aria-labelledby": "query-canvas-title" },
        React.createElement("div", { className: "query-canvas__heading" },
            React.createElement("h2", { id: "query-canvas-title" }, "Query canvas"),
            React.createElement("span", { title: runtime.experimentalVisual ? 'Combine text, visual references, selected details, exclusions, and catalog filters.' : 'Search the catalog with text and filters.' },
                React.createElement(Icon, { name: "help", size: 14 }))),
        React.createElement("p", { className: "query-canvas__scope", "aria-live": "polite" }, runtime.experimentalVisual ? React.createElement(React.Fragment, null,
            queryScopeDescription(state),
            " ",
            React.createElement("span", null, "Experimental references use color, light and composition; no object recognition.")) : `Searches ${(state.corpus?.items.length ?? 0).toLocaleString()} catalog records.`),
        React.createElement("div", { className: "query-canvas__terms" }, state.queryTerms.map((term) => {
            const artwork = artworkById(state, term.artworkId ?? null);
            const preview = term.previewUrl ?? artwork?.thumbnailUrl ?? artwork?.imageUrl;
            return (React.createElement("article", { className: `query-term query-term--${term.polarity}`, key: term.id },
                React.createElement("span", { className: "query-term__visual" }, preview ? (React.createElement(ArtworkImage, { src: preview, alt: "", fallbackLabel: "Ref", width: artwork?.imageWidth, height: artwork?.imageHeight, dominantColor: artwork?.dominantColor })) : (React.createElement(Icon, { name: term.kind === 'text' ? 'text' : term.kind === 'detail' ? 'crop' : 'image', size: 15 }))),
                React.createElement("span", { className: "query-term__copy" },
                    React.createElement("strong", { title: term.label }, term.label),
                    React.createElement("small", null, term.kind === 'text' ? 'Text' : term.kind === 'detail' ? 'Selected detail' : term.kind === 'image' ? 'Image reference' : term.pinned ? 'Pinned artwork' : 'Artwork reference')),
                runtime.experimentalVisual && React.createElement("button", { type: "button", className: `query-term__polarity query-term__polarity--${term.polarity}`, onClick: () => void runtime.setQueryTermPolarity(term.id, term.polarity === 'positive' ? 'negative' : 'positive'), "aria-label": `Use ${term.label} as ${term.polarity === 'positive' ? 'negative' : 'positive'} evidence` }, term.polarity === 'positive' ? 'Positive' : 'Negative'),
                (term.kind !== 'text' || state.queryTerms.some((other) => other.id !== term.id && other.polarity === 'positive')) && React.createElement("button", { type: "button", className: "query-term__remove", onClick: () => void runtime.removeQueryTerm(term.id), "aria-label": `Remove ${term.label}` },
                    React.createElement(Icon, { name: "close", size: 13 }))));
        })),
        React.createElement("div", { className: "query-canvas__chips", "aria-label": "Active filters" },
            state.queryFilters.map((filter) => (React.createElement("button", { type: "button", key: filter.id, onClick: () => void runtime.removeFilter(filter.id), title: `Remove ${filter.label}` },
                React.createElement("span", null, filter.label),
                React.createElement(Icon, { name: "close", size: 12 })))),
            state.scopedCollectionId && (React.createElement("button", { type: "button", onClick: () => void runtime.scopeCollection(null), title: "Search the complete collection" },
                React.createElement("span", null, state.savedCollections.find((collection) => collection.id === state.scopedCollectionId)?.name ?? 'Saved collection'),
                React.createElement(Icon, { name: "close", size: 12 })))),
        React.createElement("div", { className: "query-canvas__actions" },
            runtime.experimentalVisual && React.createElement(React.Fragment, null,
                React.createElement("input", { ref: fileRef, type: "file", accept: "image/png,image/jpeg,image/webp,image/avif", onChange: (event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file)
                            void runtime.searchUpload(file);
                        event.currentTarget.value = '';
                    }, "aria-label": "Add an image reference" }),
                React.createElement("button", { type: "button", onClick: () => fileRef.current?.click(), disabled: !state.corpus || state.indexPhase === 'visualizing' },
                    React.createElement(Icon, { name: "image", size: 14 }),
                    React.createElement("span", null, "Add reference"))),
            React.createElement("div", { className: "query-filter-anchor" },
                React.createElement("button", { ref: filterRef, type: "button", "aria-haspopup": "dialog", "aria-expanded": filtersOpen, onClick: () => setFiltersOpen((open) => !open) },
                    React.createElement(Icon, { name: "filter", size: 14 }),
                    React.createElement("span", null, "Add filter")),
                filtersOpen && React.createElement(QueryFilterMenu, { anchor: filterRef.current, onClose: () => setFiltersOpen(false) })))));
}
//# sourceMappingURL=QueryCanvas.js.map