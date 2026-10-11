import { React } from '../../shared/react.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
import { LogoMark } from '../../shared/ui/LogoMark.js';
import { CommandButton } from '../../../../../src/ui/primitives/CommandButton.js';
function dateLabel(artwork) {
    if (artwork.objectDate)
        return artwork.objectDate;
    if (artwork.year !== null)
        return String(artwork.year);
    return 'Date unknown';
}
export function FeaturedMatchNode(props) {
    const style = {
        '--featured-color': 'var(--selection)'
    };
    const className = `featured-match-node${props.selected ? ' is-selected' : ''}`;
    return (React.createElement(CommandButton, { command: props.command, artworkId: props.artwork.id, flipId: props.artwork.id, className: className, style: style, label: `${props.label}: ${props.artwork.title} by ${props.artwork.creator}. Query: ${props.queryText}`, selected: props.selected },
        React.createElement("span", { className: "featured-match-node__spark", "aria-hidden": "true" },
            React.createElement(LogoMark, { size: 19 })),
        React.createElement("span", { className: "featured-match-node__label" }, props.label),
        React.createElement("span", { className: "featured-match-node__border" },
            React.createElement("span", { className: "featured-match-node__frame" },
                React.createElement("span", { className: "featured-match-node__image" },
                    React.createElement(ArtworkImage, { src: props.artwork.thumbnailUrl ?? props.artwork.imageUrl ?? props.artwork.detailImageUrl, alt: "", eager: true, priority: true, sizes: "(max-width: 680px) 110px, 160px", fallbackLabel: "Met", width: props.artwork.imageWidth, height: props.artwork.imageHeight, dominantColor: props.artwork.dominantColor })),
                React.createElement("span", { className: "featured-match-node__copy" },
                    React.createElement("strong", null, props.artwork.title),
                    React.createElement("small", null, props.artwork.creator || 'Unknown maker'),
                    React.createElement("small", null, dateLabel(props.artwork)),
                    React.createElement("em", null, "The Metropolitan Museum of Art")))),
        props.label !== 'Featured artwork' && React.createElement("span", { className: "featured-match-node__rank", "aria-hidden": "true" }, "1")));
}
