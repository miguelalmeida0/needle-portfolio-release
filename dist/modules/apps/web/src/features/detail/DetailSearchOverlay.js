import { React, useEffect, useRef, useState } from '../../shared/react.js';
import { imageUrl } from '../../shared/images/image-sizing.js';
import { Icon } from '../../shared/icons.js';
import { ArtworkImage } from '../../shared/ui/ArtworkImage.js';
import { detailSearchArtwork } from '../../app/app.selectors.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
const DEFAULT_CROP = { x: .28, y: .25, width: .44, height: .44 };
export function DetailSearchOverlay() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const artwork = detailSearchArtwork(state);
    const stageRef = useRef(null);
    const dragRef = useRef(null);
    const [crop, setCrop] = useState(DEFAULT_CROP);
    const [busy, setBusy] = useState(false);
    useEffect(() => setCrop(DEFAULT_CROP), [artwork?.id]);
    useEffect(() => {
        if (!artwork)
            return;
        const previous = document.activeElement;
        const dialog = document.querySelector('.detail-search-dialog');
        const focusable = () => [...(dialog?.querySelectorAll('button:not(:disabled), [tabindex="0"]') ?? [])];
        focusable()[0]?.focus({ preventScroll: true });
        const keydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                runtime.closeDetailSearch();
            }
            if (event.key === 'Tab') {
                const items = focusable(), first = items[0], last = items.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', keydown);
        return () => { document.removeEventListener('keydown', keydown); previous?.focus({ preventScroll: true }); };
    }, [artwork?.id]);
    if (!artwork)
        return null;
    const source = imageUrl(artwork.detailImageUrl ?? artwork.imageUrl, 640);
    const pointerPosition = (event) => {
        const rect = stageRef.current?.getBoundingClientRect();
        if (!rect)
            return null;
        return {
            x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        };
    };
    const onPointerDown = (event) => {
        const point = pointerPosition(event);
        if (!point)
            return;
        dragRef.current = { startX: point.x, startY: point.y };
        setCrop({ x: point.x, y: point.y, width: .01, height: .01 });
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
        const drag = dragRef.current;
        const point = pointerPosition(event);
        if (!drag || !point)
            return;
        const x = Math.min(drag.startX, point.x);
        const y = Math.min(drag.startY, point.y);
        const width = Math.max(.06, Math.abs(point.x - drag.startX));
        const height = Math.max(.06, Math.abs(point.y - drag.startY));
        setCrop({ x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y) });
    };
    const onPointerUp = () => { dragRef.current = null; };
    const submit = async () => {
        if (!source || busy)
            return;
        setBusy(true);
        try {
            await runtime.addDetailReference(cropImage(source, crop), artwork.id, crop);
        }
        finally {
            setBusy(false);
        }
    };
    return (React.createElement("div", { className: "detail-search-overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "detail-search-dialog-title" },
        React.createElement("button", { className: "detail-search-overlay__scrim", type: "button", onClick: () => runtime.closeDetailSearch(), "aria-label": "Close detail search" }),
        React.createElement("section", { className: "detail-search-dialog" },
            React.createElement("header", null,
                React.createElement("div", null,
                    React.createElement("span", null, "Search this detail"),
                    React.createElement("h2", { id: "detail-search-dialog-title" }, "Choose the visual region that matters")),
                React.createElement("button", { type: "button", className: "icon-button", onClick: () => runtime.closeDetailSearch(), "aria-label": "Close detail search" },
                    React.createElement(Icon, { name: "close", size: 18 }))),
            React.createElement("div", { className: "detail-search-stage", ref: stageRef, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp },
                React.createElement(ArtworkImage, { role: "detail", sizes: "(max-width: 640px) 90vw, 640px", src: source, alt: artwork.title, eager: true, width: artwork.imageWidth, height: artwork.imageHeight, dominantColor: artwork.dominantColor }),
                React.createElement("div", { className: "detail-search-stage__shade" }),
                React.createElement("div", { className: "detail-search-stage__crop", style: { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` } },
                    React.createElement("i", null),
                    React.createElement("i", null),
                    React.createElement("i", null),
                    React.createElement("i", null))),
            React.createElement("footer", null,
                React.createElement("p", null, "Drag anywhere on the artwork. The selected region becomes a positive visual ingredient in the current query."),
                React.createElement("div", null,
                    React.createElement("button", { type: "button", className: "detail-search-cancel", onClick: () => runtime.closeDetailSearch() }, "Cancel"),
                    React.createElement("button", { type: "button", className: "detail-search-submit", onClick: () => void submit(), disabled: busy },
                        React.createElement(Icon, { name: "crop", size: 16 }),
                        React.createElement("span", null, busy ? 'Preparing detail' : 'Add detail to query')))))));
}
async function cropImage(source, crop) {
    try {
        const response = await fetch(source, { mode: 'cors' });
        if (!response.ok)
            return null;
        const original = await response.blob();
        const image = await createImageBitmap(original);
        const sx = Math.max(0, Math.floor(crop.x * image.width));
        const sy = Math.max(0, Math.floor(crop.y * image.height));
        const sw = Math.max(1, Math.floor(crop.width * image.width));
        const sh = Math.max(1, Math.floor(crop.height * image.height));
        const edge = Math.min(640, Math.max(180, Math.max(sw, sh)));
        const canvas = document.createElement('canvas');
        const scale = edge / Math.max(sw, sh);
        canvas.width = Math.max(1, Math.round(sw * scale));
        canvas.height = Math.max(1, Math.round(sh * scale));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context)
            return null;
        context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        image.close();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .88));
        if (!blob)
            return null;
        return { blob, previewUrl: canvas.toDataURL('image/jpeg', .84) };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=DetailSearchOverlay.js.map