import { React } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { LoadingMark } from '../../shared/ui/LoadingMark.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
const suggestions = [
    'A cat with main-character energy',
    'Armor that looks alive',
    'Someone deeply unimpressed',
    'A dramatic sky before a storm'
];
export function SearchSuggestions() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const busy = state.status === 'searching' || state.status === 'truth-checking' || state.status === 'probing';
    return (React.createElement("div", { className: "search-suggestions", "aria-label": "Suggested searches" },
        React.createElement("span", null, "Try a search"),
        React.createElement("div", { className: "search-suggestions__list" }, suggestions.map((suggestion) => (React.createElement("button", { type: "button", key: suggestion, disabled: busy, onClick: () => {
                runtime.setDraft(suggestion);
                void runtime.searchText(suggestion, true);
            } },
            React.createElement("span", null, suggestion),
            React.createElement(Icon, { name: "arrow-right", size: 13 }))))),
        React.createElement("button", { className: "truth-challenge-button", type: "button", disabled: busy || !state.approximate, onClick: () => void runtime.findWeakQuery() },
            React.createElement("span", { className: "truth-challenge-button__icon" }, state.status === 'probing' ? React.createElement(LoadingMark, { label: "Finding a weak query" }) : React.createElement(Icon, { name: "target", size: 16 })),
            React.createElement("span", null,
                React.createElement("strong", null, "Find a query that breaks it"),
                React.createElement("small", null, "Automatically hunt for a real recall failure.")),
            React.createElement(Icon, { name: "arrow-right", size: 14 }))));
}
//# sourceMappingURL=SearchSuggestions.js.map