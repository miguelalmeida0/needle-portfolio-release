import { React } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
import { effectiveSearchBudget, maximumSearchBudget, recall } from '../../app/app.selectors.js';
import { formatDuration, formatPercent } from '../../shared/utils/format.js';
const MINIMUM_BUDGET = 8;
const RANGE_STEPS = 1000;
function indexStatus(state) {
    if (state.indexPhase === 'hybrid')
        return 'Local HNSW';
    if (state.indexPhase === 'visualizing')
        return `Visual index ${state.visualIndexProgress.completed}/${state.visualIndexProgress.total}`;
    if (state.indexPhase === 'semantic-only')
        return (state.corpus?.source.mode === 'met-pack' || state.corpus?.source.mode === 'met-hybrid-pack') ? 'HNSW index' : 'Metadata index';
    return state.corpus ? 'Local HNSW' : 'Preparing metadata index';
}
function positionForBudget(budget, maximum) {
    const clamped = Math.max(MINIMUM_BUDGET, Math.min(maximum, budget));
    const ratio = Math.log(clamped / MINIMUM_BUDGET) / Math.log(maximum / MINIMUM_BUDGET);
    return Math.round(ratio * RANGE_STEPS);
}
function budgetForPosition(position, maximum) {
    const ratio = Math.max(0, Math.min(1, position / RANGE_STEPS));
    return Math.max(MINIMUM_BUDGET, Math.min(maximum, Math.round(MINIMUM_BUDGET * ((maximum / MINIMUM_BUDGET) ** ratio))));
}
export function AccuracyControl() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const maximum = maximumSearchBudget(state);
    const budget = effectiveSearchBudget(state);
    const position = positionForBudget(budget, maximum);
    const progress = position / RANGE_STEPS * 100;
    const measuredRecall = recall(state);
    const approximate = state.approximate;
    return (React.createElement("section", { className: "accuracy-control", "aria-labelledby": "accuracy-control-title" },
        React.createElement("div", { className: "accuracy-control__edge accuracy-control__edge--left" },
            React.createElement(Icon, { name: "lightning", size: 22 }),
            React.createElement("div", null,
                React.createElement("strong", null, "Faster"),
                React.createElement("span", null, "Fewer graph visits"))),
        React.createElement("div", { className: "accuracy-control__center" },
            React.createElement("div", { className: "accuracy-control__title-row" },
                React.createElement("h2", { id: "accuracy-control-title" }, "Search speed vs accuracy"),
                React.createElement("span", { title: "This logarithmic control directly changes the HNSW efSearch candidate budget." },
                    React.createElement(Icon, { name: "help", size: 15 }))),
            React.createElement("div", { className: "range-shell", style: { '--range-progress': `${progress}%` } },
                React.createElement("input", { type: "range", min: "0", max: RANGE_STEPS, step: "1", value: position, onInput: (event) => runtime.setEfSearch(budgetForPosition(Number(event.currentTarget.value), maximum)), "aria-label": "Search speed versus accuracy", "aria-valuetext": `HNSW search budget ${budget}` })),
            React.createElement("div", { className: "accuracy-control__telemetry", "aria-live": "polite" },
                React.createElement("span", { className: `index-state index-state--${state.corpus && state.indexPhase === 'semantic' ? 'hybrid' : state.indexPhase}` },
                    React.createElement("i", null),
                    indexStatus(state)),
                React.createElement("span", null,
                    React.createElement("b", null,
                        "ef ",
                        budget)),
                React.createElement("span", null, approximate ? `${formatPercent(approximate.inspectedRatio, 2)} inspected` : 'Preparing index'),
                React.createElement("span", null, approximate ? formatDuration(approximate.elapsedMs) : '—'),
                measuredRecall !== null && React.createElement("span", null,
                    React.createElement("b", null,
                        formatPercent(measuredRecall),
                        " recall")))),
        React.createElement("div", { className: "accuracy-control__edge accuracy-control__edge--right" },
            React.createElement("div", null,
                React.createElement("strong", null, "More accurate"),
                React.createElement("span", null,
                    "Up to ef ",
                    maximum.toLocaleString())),
            React.createElement(Icon, { name: "target", size: 23 }))));
}
//# sourceMappingURL=AccuracyControl.js.map