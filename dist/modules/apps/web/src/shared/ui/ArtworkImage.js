import { React, useState } from '../react.js';
import { canResize, imagePriority, imageSrcSet, imageUrl, mediumSource } from '../images/image-sizing.js';
const decodedSources = new Map();
export function ArtworkImage(props) {
    return React.createElement(ImageResource, { key: props.src ?? 'missing', ...props });
}
function ImageResource(props) {
    const [attempt, setAttempt] = useState(0);
    const [ready, setReady] = useState(false);
    const source = attempt === 3 ? props.fallbackSrc : props.src;
    const role = props.role ?? 'tile';
    const format = attempt === 0 ? 'avif' : attempt === 1 ? 'webp' : 'jpeg';
    const preview = decodedSources.get(mediumSource(props.fallbackSrc ?? source ?? ''));
    const style = { backgroundColor: props.dominantColor ?? '#efeee8', aspectRatio: `${props.width || 1} / ${props.height || 1}`,
        backgroundImage: role === 'detail' && !ready && preview ? `url("${preview}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' };
    const exhaustedFallback = attempt === 3 && mediumSource(props.fallbackSrc ?? '') === mediumSource(props.src ?? '');
    if (!source || attempt > 3 || exhaustedFallback) {
        return React.createElement("span", { className: `artwork-image-fallback ${props.className ?? ''}`, role: "img", "aria-label": props.alt || props.fallbackLabel || 'Artwork image unavailable', style: style },
            React.createElement("span", { "aria-hidden": "true" }, "N"),
            React.createElement("small", null, props.fallbackLabel ?? 'Image unavailable'));
    }
    return React.createElement("img", { className: `${props.className ?? ''}${ready ? ' is-ready' : ' is-loading'}`.trim(), src: imageUrl(source, role === 'detail' ? 640 : 160, format), srcSet: imageSrcSet(source, role, format), sizes: props.sizes ?? (role === 'detail' ? '(max-width: 640px) 90vw, 300px' : '80px'), alt: props.alt, width: props.width || 1, height: props.height || 1, ...imagePriority(props.eager, props.priority), draggable: props.draggable ?? false, style: style, onLoad: (event) => {
            setReady(true);
            const key = mediumSource(source);
            decodedSources.delete(key);
            decodedSources.set(key, event.currentTarget.currentSrc);
            if (decodedSources.size > 96)
                decodedSources.delete(decodedSources.keys().next().value);
        }, onError: () => { setReady(false); setAttempt(canResize(source) && attempt < 2 ? attempt + 1 : attempt === 3 ? 4 : 3); } });
}
//# sourceMappingURL=ArtworkImage.js.map