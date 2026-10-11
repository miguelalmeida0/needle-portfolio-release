import { React, useEffect, useRef } from '../../shared/react.js';
import { gsap } from 'gsap';
import { discoveryMotion } from '../../shared/discovery-motion.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
import { CommandButton } from '../../../../../src/ui/primitives/CommandButton.js';
import { catalogueDate } from '../../../../../src/core/discovery/select.js';
export function DiscoveryShelf(props) {
    const root = useRef(null);
    useEffect(() => {
        return discoveryMotion(() => {
            const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
            timeline.fromTo('.discovery-card__frame', { x: -7, scale: .96, clipPath: 'inset(0 10% 0 0 round 6px)' }, { x: 0, scale: 1, clipPath: 'inset(0 0% 0 0 round 6px)', duration: .38, stagger: .035, clearProps: 'transform,clipPath' })
                .fromTo('.discovery-card__copy', { x: 5, opacity: .35 }, { x: 0, opacity: 1, duration: .3, stagger: .035, clearProps: 'transform,opacity' }, .045);
        }, root.current);
    }, []);
    return React.createElement("section", { ref: root, className: "discovery-shelf", "aria-labelledby": "discovery-heading" },
        React.createElement("h2", { id: "discovery-heading", tabIndex: -1 }, "Recommended artworks"),
        React.createElement("p", { className: "discovery-announcement", role: "status" },
            props.items.length,
            " recommended artworks available."),
        React.createElement("ul", { className: "discovery-track" }, props.items.map(({ artwork }) => React.createElement("li", { key: artwork.id },
            React.createElement(CommandButton, { command: props.select(artwork.id), artworkId: artwork.id, label: `${artwork.title}, ${catalogueDate(artwork)}`, selected: props.selected === artwork.id, className: "discovery-card" },
                React.createElement("span", { className: "discovery-card__frame" },
                    React.createElement(ArtworkImage, { src: artwork.thumbnailUrl || artwork.imageUrl || artwork.detailImageUrl, fallbackSrc: artwork.thumbnailFallbackUrls?.[0], alt: "", sizes: "(max-width: 980px) 104px, 54px", width: artwork.imageWidth, height: artwork.imageHeight, fallbackLabel: "Image unavailable" })),
                React.createElement("span", { className: "discovery-card__copy" },
                    React.createElement("strong", null, artwork.title),
                    React.createElement("small", null, catalogueDate(artwork))))))));
}
//# sourceMappingURL=DiscoveryShelf.js.map