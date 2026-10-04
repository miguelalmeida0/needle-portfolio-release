import { React } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { LogoMark } from '../../shared/ui/LogoMark.js';
import { LoadingMark } from '../../shared/ui/LoadingMark.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
import { artworkById, effectiveSearchBudget, missedExactIds, recall } from '../../app/app.selectors.js';
import { formatPercent } from '../../shared/utils/format.js';
export function TruthLens() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const measuredRecall = recall(state);
    const missed = missedExactIds(state).size;
    const busy = state.status === 'truth-checking' || state.status === 'probing';
    const topMatch = artworkById(state, state.approximate?.hits[0]?.id ?? null);
    const visualRecipe = state.queryTerms.some((term) => term.kind === 'image' || term.kind === 'detail');
    if (state.status === 'probing') {
        return (React.createElement("section", { className: "truth-lens truth-lens--busy", "aria-live": "polite" },
            React.createElement(LoadingMark, { label: "Probing search quality" }),
            React.createElement("div", null,
                React.createElement("strong", null, "Finding a query that breaks the index"),
                React.createElement("span", null, "Testing fast search against mathematical ground truth."))));
    }
    if (state.status === 'truth-checking') {
        return (React.createElement("section", { className: `truth-lens truth-lens--busy${visualRecipe ? ' truth-lens--visual' : ''}`, "aria-live": "polite" },
            React.createElement(LoadingMark, { label: "Running exhaustive search" }),
            React.createElement("div", { className: visualRecipe ? 'truth-lens__copy' : undefined },
                React.createElement("strong", null, visualRecipe ? `Checking ${state.visualIndexProgress.completed.toLocaleString()} visual vectors` : 'Checking every vector'),
                React.createElement("span", null, visualRecipe ? `Exhaustive top-${state.resultCount} in the ${state.visualIndexProgress.completed.toLocaleString()}-artwork visual index.` : `The exact oracle is building the true top-${state.resultCount}.`))));
    }
    if (state.approximate?.hits.length === 0 && (!state.exact || state.exact.hits.length === 0)) {
        return (React.createElement("section", { className: "truth-lens", "aria-label": "Truth check" },
            React.createElement("span", { className: "truth-lens__icon" },
                React.createElement(Icon, { name: "help", size: 16 })),
            React.createElement("div", { className: "truth-lens__copy" },
                React.createElement("strong", null, "No matching artworks"),
                React.createElement("span", null, state.exact ? 'Exhaustive search found no matches for this query and filters.' : 'Try changing the query or filters, or verify with Truth check.')),
            !state.exact && React.createElement("button", { type: "button", onClick: () => void runtime.showTruth() },
                "Truth check ",
                React.createElement(Icon, { name: "arrow-right", size: 15 }))));
    }
    if (!state.exact) {
        return (React.createElement("section", { className: `truth-lens${visualRecipe ? ' truth-lens--visual' : ''}`, "aria-label": "Truth check" },
            React.createElement("span", { className: "truth-lens__icon" },
                React.createElement(LogoMark, { size: 20 })),
            React.createElement("div", { className: "truth-lens__copy" },
                React.createElement("strong", null, topMatch ? `${visualRecipe ? 'Closest available' : 'Top match'} · ${topMatch.title}` : 'Fast answer'),
                React.createElement("span", null,
                    formatPercent(state.approximate?.inspectedRatio ?? 0, 1),
                    " of ",
                    visualRecipe ? `the ${state.visualIndexProgress.completed.toLocaleString()}-artwork visual index` : 'the graph',
                    " inspected \u00B7 result ready")),
            React.createElement("button", { type: "button", onClick: () => void runtime.showTruth(), disabled: busy || !state.approximate },
                "Truth check ",
                React.createElement(Icon, { name: "arrow-right", size: 15 }))));
    }
    const success = missed === 0;
    return (React.createElement("section", { className: `truth-lens truth-lens--result ${success ? 'is-success' : 'is-miss'}${visualRecipe ? ' truth-lens--visual' : ''}`, "aria-live": "polite" },
        React.createElement("span", { className: "truth-lens__icon" },
            React.createElement(Icon, { name: success ? 'target' : 'help', size: 16 })),
        React.createElement("div", { className: "truth-lens__copy" },
            React.createElement("strong", null, visualRecipe ? `${state.visualIndexProgress.completed.toLocaleString()}-artwork visual index: ${success ? 'all neighbors found' : `${missed} neighbors missed`}` : success ? 'Fast search found every true neighbor' : `Fast search missed ${missed} true ${missed === 1 ? 'neighbor' : 'neighbors'}`),
            React.createElement("span", null, measuredRecall === null ? 'Truth comparison ready' : `${formatPercent(measuredRecall)} recall${visualRecipe ? ` in the ${state.visualIndexProgress.completed.toLocaleString()}-artwork visual index` : ''} at ef ${effectiveSearchBudget(state)}`)),
        React.createElement("div", { className: "truth-lens__switch", role: "group", "aria-label": "Visible result set" },
            React.createElement("button", { type: "button", className: state.resultMode === 'fast' ? 'is-active' : '', onClick: () => runtime.showFast() }, "Fast"),
            React.createElement("button", { type: "button", className: state.resultMode === 'truth' ? 'is-active' : '', onClick: () => void runtime.showTruth() }, "Truth"))));
}
