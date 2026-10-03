import { React, useEffect, useRef, useState } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
import { QueryFilterMenu } from '../query/QueryFilterMenu.js';
const viewOptions = [
    { id: 'space', label: 'Semantic space', description: 'Browse every artwork in its neighborhood.' },
    { id: 'focus', label: 'Result focus', description: 'Pull the active neighbors around the query.' },
    { id: 'wall', label: 'Collection wall', description: 'Browse the active image-backed collection.' }
];
export function MapToolbar() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filterRef = useRef(null);
    const viewRef = useRef(null);
    const [viewsOpen, setViewsOpen] = useState(false);
    const currentView = viewOptions.find((option) => option.id === state.mapView) ?? viewOptions[0];
    const filterCount = state.queryFilters.length + (state.scopedCollectionId ? 1 : 0);
    useEffect(() => {
        if (!viewsOpen)
            return;
        const anchor = viewRef.current;
        const container = anchor?.parentElement;
        if (!anchor || !container)
            return;
        const options = () => [...container.querySelectorAll('[role="menuitemradio"]')];
        const close = () => { setViewsOpen(false); anchor.focus({ preventScroll: true }); };
        const keyboard = (event) => {
            if (!container.contains(event.target))
                return;
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
            }
            else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const items = options();
                const current = items.indexOf(document.activeElement);
                const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1)
                    : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
            }
        };
        const outside = (event) => {
            if (!container.contains(event.target)) {
                event.preventDefault();
                close();
            }
        };
        const focusOutside = (event) => {
            if (!container.contains(event.target))
                setViewsOpen(false);
        };
        document.addEventListener('focusin', focusOutside);
        document.addEventListener('keydown', keyboard);
        document.addEventListener('pointerdown', outside, true);
        return () => {
            document.removeEventListener('focusin', focusOutside);
            document.removeEventListener('keydown', keyboard);
            document.removeEventListener('pointerdown', outside, true);
        };
    }, [viewsOpen]);
    return (React.createElement("header", { className: "map-toolbar" },
        React.createElement("div", { className: "map-toolbar__left" },
            React.createElement("div", { className: "view-anchor" },
                React.createElement("button", { type: "button", ref: viewRef, className: "toolbar-button toolbar-button--view", "aria-expanded": viewsOpen, "aria-haspopup": "menu", onClick: () => setViewsOpen((value) => !value) },
                    React.createElement("span", null, currentView.label),
                    React.createElement(Icon, { name: "chevron-down", size: 16 })),
                viewsOpen && (React.createElement("div", { className: "view-popover", role: "menu", "aria-label": "Map view" }, viewOptions.map((option) => (React.createElement("button", { type: "button", role: "menuitemradio", "aria-checked": state.mapView === option.id, className: state.mapView === option.id ? 'is-selected' : '', key: option.id, onClick: () => {
                        runtime.setMapView(option.id);
                        setViewsOpen(false);
                        viewRef.current?.focus({ preventScroll: true });
                    } },
                    React.createElement("span", null, option.label),
                    React.createElement("small", null, option.description))))))),
            React.createElement("span", { className: "toolbar-help", title: "The map reorganizes continuously as query ingredients and filters change." },
                React.createElement(Icon, { name: "help", size: 20 }))),
        React.createElement("div", { className: "map-toolbar__right" },
            React.createElement("div", { className: "filter-anchor" },
                React.createElement("button", { type: "button", className: `toolbar-button${filterCount ? ' is-active' : ''}`, ref: filterRef, "aria-haspopup": "dialog", "aria-expanded": filtersOpen, onClick: () => setFiltersOpen((value) => !value) },
                    React.createElement(Icon, { name: "filter", size: 18 }),
                    React.createElement("span", null, "Filters"),
                    filterCount > 0 && React.createElement("b", { className: "toolbar-count" }, filterCount)),
                filtersOpen && React.createElement(QueryFilterMenu, { anchor: filterRef.current, onClose: () => setFiltersOpen(false) })))));
}
//# sourceMappingURL=MapToolbar.js.map