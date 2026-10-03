export const IMAGE_WIDTHS = [160, 320, 640, 1280];
export function mediumSource(source) {
    return source.replace(/(https:\/\/images\.metmuseum\.org\/CRDImages\/[^/]+\/)original\//i, '$1web-large/');
}
export function canResize(source) {
    return /^\/packs\/[^/]+\/images\//.test(source) || source.startsWith('/assets/met/')
        || /^https:\/\/images\.metmuseum\.org\/CRDImages\/[^/]+\/web-large\//i.test(mediumSource(source));
}
export function imageUrl(source, width, format = 'avif') {
    const safeSource = mediumSource(source);
    if (!canResize(safeSource))
        return safeSource;
    const size = IMAGE_WIDTHS.find(candidate => candidate >= width) ?? 1280;
    return `/_image?src=${encodeURIComponent(safeSource)}&w=${size}&format=${format}`;
}
export function imageSrcSet(source, role, format) {
    if (!canResize(source))
        return undefined;
    return IMAGE_WIDTHS.filter(width => role === 'detail' || width <= 640)
        .map(width => `${imageUrl(source, width, format)} ${width}w`).join(', ');
}
export function imagePriority(eager = false, priority = false) {
    return { loading: eager ? 'eager' : 'lazy', decoding: 'async', fetchPriority: priority ? 'high' : eager ? 'auto' : 'low' };
}
//# sourceMappingURL=image-sizing.js.map