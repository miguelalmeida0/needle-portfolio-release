import { React } from '../react.js';
import { monolithPaths, monolithViewBox } from './monolith.js';
/** Decorative within a named lockup/control; its accessible name belongs to the parent. */
export function LogoMark(props) {
    return (React.createElement("svg", { className: `logo-mark ${props.className ?? ''}`, viewBox: monolithViewBox, width: props.size ?? 24, height: props.size ?? 24, "aria-hidden": "true", focusable: "false" },
        React.createElement("path", { d: monolithPaths[0], fill: "var(--logo-primary)" }),
        React.createElement("path", { d: monolithPaths[1], fill: "var(--logo-secondary)" })));
}
