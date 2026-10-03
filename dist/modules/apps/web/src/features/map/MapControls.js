import { React } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
export function MapControls(props) {
    return (React.createElement("div", { className: "map-controls", "aria-label": "Map controls" },
        React.createElement("button", { type: "button", onClick: props.onZoomIn, "aria-label": "Zoom in" },
            React.createElement(Icon, { name: "plus", size: 18 })),
        React.createElement("button", { type: "button", onClick: props.onZoomOut, "aria-label": "Zoom out" },
            React.createElement(Icon, { name: "minus", size: 18 })),
        React.createElement("button", { type: "button", onClick: props.onReset, "aria-label": "Center map" },
            React.createElement(Icon, { name: "target", size: 18 })),
        React.createElement("span", { className: "map-controls__break" }),
        React.createElement("button", { type: "button", onClick: props.onExpand, "aria-label": "Toggle fullscreen" },
            React.createElement(Icon, { name: "expand", size: 18 }))));
}
//# sourceMappingURL=MapControls.js.map