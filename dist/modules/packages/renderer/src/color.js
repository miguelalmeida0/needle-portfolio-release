export function hexToRgba(hex, alpha = 1) {
    const normalized = hex.replace('#', '');
    const value = Number.parseInt(normalized.length === 3
        ? normalized.split('').map((character) => `${character}${character}`).join('')
        : normalized, 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, alpha];
}
//# sourceMappingURL=color.js.map