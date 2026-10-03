import { React } from '../../shared/react.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
export function ArtworkNode(props) {
    const style = {
        '--node-x': `${props.x}px`,
        '--node-y': `${props.y}px`,
        '--node-color': props.artwork.clusterColor,
        '--node-delay': `${((props.artwork.id.charCodeAt(props.artwork.id.length - 1) || 0) % 9) * 18}ms`
    };
    const classNames = [
        'artwork-node',
        props.selected ? 'is-selected' : '',
        props.matched ? 'is-match' : '',
        props.missed ? 'is-missed' : '',
        props.visited ? 'is-visited' : '',
        props.dimmed ? 'is-dimmed' : ''
    ].filter(Boolean).join(' ');
    const date = props.artwork.objectDate || (props.artwork.year ? String(props.artwork.year) : 'Date unknown');
    return (React.createElement("button", { type: "button", "data-artwork-id": props.artwork.id, className: classNames, style: style, onClick: props.onSelect, "aria-label": `${props.artwork.title} by ${props.artwork.creator}, ${props.artwork.clusterLabel}${props.rank ? `, result ${props.rank}` : ''}`, "aria-pressed": props.selected },
        React.createElement(ArtworkImage, { src: props.artwork.thumbnailUrl ?? props.artwork.imageUrl, alt: "", eager: props.matched, priority: props.rank === 2, sizes: "60px", fallbackLabel: "Met", width: props.artwork.imageWidth, height: props.artwork.imageHeight, dominantColor: props.artwork.dominantColor }),
        props.rank && React.createElement("span", { className: "artwork-node__rank" }, props.rank),
        props.missed && React.createElement("span", { className: "artwork-node__missed" }, "missed by fast search"),
        React.createElement("span", { className: "artwork-node__tooltip", role: "tooltip" },
            React.createElement("strong", null, props.artwork.title),
            React.createElement("small", null,
                props.artwork.creator,
                " \u00B7 ",
                date))));
}
//# sourceMappingURL=ArtworkNode.js.map