// Presentation-only comparison state. Never modifies corpus, ranking or runtime search.
export function safeCompareIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter(id => typeof id === 'string' && id.trim()))].slice(0, 2);
}

export function toggleComparison(current, artworkId) {
  const ids = safeCompareIds(current);
  if (typeof artworkId !== 'string' || !artworkId.trim()) return ids;
  if (ids.includes(artworkId)) return ids.filter(id => id !== artworkId);
  return [...ids, artworkId].slice(-2);
}

export function comparisonTitle(query) {
  const subject = typeof query === 'string' ? query.trim().replace(/\s+/g, ' ') : '';
  if (!subject || subject.length > 36 || !/^[\p{L}\p{N} ,'-]+$/u.test(subject)) {
    return 'Two works, side by side.';
  }
  return `Two ways to see ${subject.replace(/[.!?,]+$/,'').toLowerCase()}.`;
}

export function comparisonCopy(left, right) {
  if (!left || !right) return 'Choose two artworks to examine their catalogue details.';
  const tags = value => Array.isArray(value) ? value.filter(tag => typeof tag === 'string' && tag.trim()) : [];
  const matches = new Set(tags(right.tags).map(tag => tag.toLocaleLowerCase('en').trim()));
  const shared = tags(left.tags).find(tag => matches.has(tag.toLocaleLowerCase('en').trim()));
  const mediumA = typeof left.medium === 'string' ? left.medium.trim() : '';
  const mediumB = typeof right.medium === 'string' ? right.medium.trim() : '';
  if (shared && mediumA && mediumB && mediumA.toLowerCase() !== mediumB.toLowerCase()) {
    return `Both Met records include “${shared}” in their subject tags, but use different materials: ${mediumA} and ${mediumB}.`;
  }
  if (shared) return `Both Met records include “${shared}” in their subject tags. Compare their forms and catalogue details.`;
  if (mediumA && mediumB && mediumA.toLowerCase() === mediumB.toLowerCase()) {
    return `Both works are catalogued as ${mediumA}. Examine what else they have in common.`;
  }
  return 'These works were selected for comparison. Their catalogue records do not establish a direct connection.';
}
