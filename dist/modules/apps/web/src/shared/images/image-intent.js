import { imageUrl } from './image-sizing.js';
export function installArtworkIntent(root, lookup) {
    let timer;
    let current = null;
    const recent = new Set();
    const cancel = () => { window.clearTimeout(timer); current = null; };
    const intent = (event) => {
        const connection = navigator.connection;
        if (connection?.saveData || /2g/.test(connection?.effectiveType ?? ''))
            return;
        const card = event.target?.closest('[data-artwork-id]');
        if (card === current)
            return;
        cancel();
        current = card;
        const artwork = card ? lookup(card.getAttribute('data-artwork-id') ?? '') : null;
        if (!artwork)
            return;
        timer = window.setTimeout(() => {
            const url = imageUrl(artwork.detailImageUrl ?? artwork.imageUrl, window.devicePixelRatio > 1 ? 640 : 320);
            if (recent.has(url))
                return;
            recent.add(url);
            if (recent.size > 24)
                recent.delete(recent.values().next().value);
            const image = new Image();
            image.decoding = 'async';
            image.fetchPriority = 'low';
            image.src = url;
        }, event.type === 'focusin' ? 0 : 125);
    };
    const leave = (event) => {
        const next = event.relatedTarget;
        if (!current?.contains(next))
            cancel();
    };
    root.addEventListener('pointerover', intent, { passive: true });
    root.addEventListener('pointerout', leave, { passive: true });
    root.addEventListener('focusin', intent);
    root.addEventListener('focusout', leave);
    return () => {
        cancel();
        root.removeEventListener('pointerover', intent);
        root.removeEventListener('pointerout', leave);
        root.removeEventListener('focusin', intent);
        root.removeEventListener('focusout', leave);
    };
}
//# sourceMappingURL=image-intent.js.map