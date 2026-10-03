let sequence = 0;
export function createRequestId(prefix = 'request') {
    sequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}
//# sourceMappingURL=id.js.map