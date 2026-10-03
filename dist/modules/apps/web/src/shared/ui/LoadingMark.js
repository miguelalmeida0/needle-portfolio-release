import { React } from '../react.js';
export function LoadingMark(props) {
    return (React.createElement("span", { className: "loading-mark", role: "status", "aria-label": props.label ?? 'Loading' },
        React.createElement("span", null),
        React.createElement("span", null),
        React.createElement("span", null)));
}
//# sourceMappingURL=LoadingMark.js.map