const WORD_PATTERN = /[\p{L}\p{N}]+/gu;
export function tokenize(input) {
    return (input.toLowerCase().match(WORD_PATTERN) ?? [])
        .map((token) => token.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''))
        .filter((token) => token.length > 1);
}
//# sourceMappingURL=tokenize.js.map