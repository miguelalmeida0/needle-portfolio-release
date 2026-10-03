import { React, useRef, useState } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { SearchComposer } from '../search/SearchComposer.js';
import { RecentQueries } from '../history/RecentQueries.js';
import { QueryCanvas } from '../query/QueryCanvas.js';
import { SavedCollections } from '../collections/SavedCollections.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
function NeedleMark() {
    return (React.createElement("svg", { className: "needle-mark", viewBox: "0 0 34 46", "aria-hidden": "true" },
        React.createElement("path", { d: "M22 2 11 23l6-1-5 22 12-25-6 2Z", fill: "none", stroke: "currentColor", strokeWidth: "1.35" })));
}
export function SearchSidebar() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const collectionsRef = useRef(null);
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    return (React.createElement("aside", { className: `search-sidebar${workspaceOpen ? ' is-workspace-open' : ''}` },
        React.createElement("div", { className: "brand-lockup" },
            React.createElement(NeedleMark, null),
            React.createElement("span", { className: "brand-lockup__copy" },
                React.createElement("strong", null, "Needle")),
            React.createElement("button", { type: "button", className: "workspace-mobile-toggle", onClick: () => setWorkspaceOpen((open) => !open), "aria-expanded": workspaceOpen, "aria-label": workspaceOpen ? 'Close search workspace' : 'Open search workspace' },
                React.createElement(Icon, { name: "layers", size: 16 }),
                React.createElement("span", null, state.queryTerms.length + state.queryFilters.length))),
        workspaceOpen && (React.createElement("button", { type: "button", className: "workspace-scrim", onClick: () => setWorkspaceOpen(false), "aria-label": "Close search workspace" })),
        React.createElement("div", { className: "sidebar-search", "aria-labelledby": "search-title" },
            React.createElement("div", { className: "sidebar-section-heading" },
                React.createElement("h1", { id: "search-title" }, "Search")),
            React.createElement(SearchComposer, null),
            state.errorMessage && React.createElement("p", { className: "sidebar-error", role: "alert" }, state.errorMessage)),
        React.createElement("div", { className: "sidebar-scroll" },
            React.createElement("div", { className: "workspace-mobile-header" },
                React.createElement("strong", null, "Search workspace"),
                React.createElement("button", { type: "button", className: "icon-button", onClick: () => setWorkspaceOpen(false), "aria-label": "Close search workspace" },
                    React.createElement(Icon, { name: "close", size: 16 }))),
            React.createElement(QueryCanvas, null),
            React.createElement(RecentQueries, null),
            React.createElement(SavedCollections, { sectionRef: collectionsRef }),
            React.createElement("div", { className: "sidebar-primary-actions" },
                React.createElement("button", { type: "button", onClick: () => void runtime.branchCurrentSearch(), disabled: state.queryTerms.length === 0 },
                    React.createElement(Icon, { name: "branch", size: 15 }),
                    React.createElement("span", null, "Branch search")),
                React.createElement("button", { type: "button", onClick: () => void runtime.saveCurrentCollection(), disabled: !state.approximate },
                    React.createElement(Icon, { name: "bookmark", size: 15 }),
                    React.createElement("span", null, "Save collection")))),
        React.createElement("nav", { className: "sidebar-footer", "aria-label": "Secondary navigation" },
            React.createElement("a", { href: "https://www.metmuseum.org/hubs/open-access", target: "_blank", rel: "noreferrer", "aria-label": "The Met Open Access" },
                React.createElement(Icon, { name: "book" })),
            React.createElement("button", { type: "button", "aria-label": "Saved collections", onClick: () => {
                    setWorkspaceOpen(true);
                    requestAnimationFrame(() => {
                        collectionsRef.current?.scrollIntoView({ block: 'nearest' });
                        collectionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
                    });
                } },
                React.createElement(Icon, { name: "bookmark" })))));
}
//# sourceMappingURL=SearchSidebar.js.map