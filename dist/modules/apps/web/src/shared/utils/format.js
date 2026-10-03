export function formatDuration(milliseconds) {
    if (milliseconds < 1)
        return `${Math.max(0.1, milliseconds).toFixed(1)} ms`;
    if (milliseconds < 10)
        return `${milliseconds.toFixed(1)} ms`;
    return `${Math.round(milliseconds)} ms`;
}
export function formatPercent(value, digits = 0) {
    return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(digits)}%`;
}
export function formatRelativeTime(timestamp, now = Date.now()) {
    const elapsed = Math.max(0, now - timestamp);
    if (elapsed < 60_000)
        return 'Just now';
    if (elapsed < 3_600_000)
        return `${Math.floor(elapsed / 60_000)} min ago`;
    if (elapsed < 86_400_000)
        return `${Math.floor(elapsed / 3_600_000)} hr ago`;
    return `${Math.floor(elapsed / 86_400_000)} day ago`;
}
//# sourceMappingURL=format.js.map