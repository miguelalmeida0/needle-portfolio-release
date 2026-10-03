import { React } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
import { compareArtworks } from '../../app/app.selectors.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
export function ComparePanel(props) {
    const runtime = useAppRuntime();
    const state = useAppState();
    const artworks = compareArtworks(state);
    if (artworks.length < 2)
        return null;
    const [left, right] = artworks;
    if (!left || !right)
        return null;
    return (React.createElement("section", { className: "compare-panel", "aria-label": "Artwork comparison" },
        React.createElement("div", { className: "compare-panel__heading" },
            React.createElement("strong", null, "Compare"),
            React.createElement("button", { type: "button", className: "icon-button", onClick: () => { runtime.clearCompare(); props.onClose(); }, "aria-label": "Close comparison" },
                React.createElement(Icon, { name: "close", size: 14 }))),
        React.createElement("div", { className: "compare-panel__cards" }, [left, right].map((artwork) => (React.createElement("button", { type: "button", key: artwork.id, onClick: () => runtime.selectArtwork(artwork.id) },
            React.createElement("span", null,
                React.createElement(ArtworkImage, { src: artwork.thumbnailUrl ?? artwork.imageUrl, alt: "", width: artwork.imageWidth, height: artwork.imageHeight, dominantColor: artwork.dominantColor })),
            React.createElement("strong", null, artwork.title),
            React.createElement("small", null, artwork.objectDate || artwork.creator))))),
        React.createElement("dl", { className: "compare-panel__facts" },
            React.createElement("div", null,
                React.createElement("dt", null, "Medium"),
                React.createElement("dd", null, sharedOrDifferent(left.medium, right.medium))),
            React.createElement("div", null,
                React.createElement("dt", null, "Culture"),
                React.createElement("dd", null, sharedOrDifferent(left.culture, right.culture))),
            React.createElement("div", null,
                React.createElement("dt", null, "Period"),
                React.createElement("dd", null, sharedOrDifferent(left.period, right.period))))));
}
function sharedOrDifferent(left, right) {
    if (!left && !right)
        return 'Not recorded';
    if (left.trim().toLowerCase() === right.trim().toLowerCase())
        return left || right;
    return 'Different';
}
//# sourceMappingURL=ComparePanel.js.map