import { React } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
export function RecentQueries() {
    const runtime = useAppRuntime();
    const state = useAppState();
    return (React.createElement("section", { className: "recent-queries", "aria-labelledby": "recent-query-title" },
        React.createElement("div", { className: "recent-queries__heading" },
            React.createElement("h2", { id: "recent-query-title" }, "Recent text queries"),
            React.createElement("span", null, state.history.length)),
        React.createElement("div", { className: "recent-queries__list" }, state.history.slice(0, 5).map((entry) => (React.createElement("button", { className: "recent-query", type: "button", key: entry.id, onClick: () => void runtime.replayRecent(entry) },
            React.createElement("span", { className: "recent-query__dot", "aria-hidden": "true" }),
            React.createElement("span", { className: "recent-query__copy" },
                React.createElement("strong", null, entry.text)),
            React.createElement(Icon, { name: "clock", size: 13 }))))),
        state.branches.length > 0 && (React.createElement("div", { className: "query-branches", "aria-label": "Saved search branches" }, state.branches.slice(0, 2).map((branch) => (React.createElement("button", { type: "button", key: branch.id, className: state.activeBranchId === branch.id ? 'is-active' : '', onClick: () => void runtime.restoreBranch(branch.id) },
            React.createElement(Icon, { name: "branch", size: 13 }),
            React.createElement("span", null, branch.name))))))));
}
//# sourceMappingURL=RecentQueries.js.map