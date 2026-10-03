import { React } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
export function QueryNode(props) {
    const imageUrl = props.uploadedPreviewUrl ?? props.artwork?.thumbnailUrl ?? props.artwork?.imageUrl;
    return (React.createElement("button", { type: "button", className: `query-node${props.busy ? ' is-busy' : ''}`, onClick: props.onSelect, "aria-label": "Inspect the current query" },
        React.createElement("span", { className: "query-node__label" }, "Your query"),
        React.createElement("span", { className: "query-node__frame" }, imageUrl ? (React.createElement(ArtworkImage, { src: imageUrl, alt: "", eager: true, fallbackLabel: "Query", width: props.artwork?.imageWidth, height: props.artwork?.imageHeight, dominantColor: props.artwork?.dominantColor })) : (React.createElement("span", { className: "query-node__text", "aria-label": props.queryText },
            React.createElement(Icon, { name: "search", size: 20 }),
            React.createElement("strong", null, props.queryText),
            React.createElement("small", null, "text query"))))));
}
//# sourceMappingURL=QueryNode.js.map