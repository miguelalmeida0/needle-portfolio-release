import { React } from '../../../apps/web/src/shared/react.js';
export function CommandButton(props) {
    return React.createElement("button", { type: "button", className: props.className, style: props.style, "data-command": props.command.id, "data-artwork-id": props.artworkId, "data-flip-id": props.flipId, "aria-label": props.label, "aria-pressed": props.selected, onClick: props.command.run }, props.children);
}
//# sourceMappingURL=CommandButton.js.map