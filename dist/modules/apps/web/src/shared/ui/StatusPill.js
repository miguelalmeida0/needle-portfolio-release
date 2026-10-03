import { React } from '../react.js';
export function StatusPill(props) {
    return React.createElement("span", { className: `status-pill status-pill--${props.tone ?? 'neutral'}` }, props.children);
}
//# sourceMappingURL=StatusPill.js.map