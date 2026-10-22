// Text relevance is grounded in catalogue evidence. Hash collisions and title
// substrings are never evidence that an artwork depicts a requested subject.
const STOP = new Set('a an the and of to for from with in on at by under over after before about me my i want would like please show find search looking look see something some any picture pictures image images artwork artworks art that this it is are has have depicts depicting containing'.split(' '));
const ALIASES = [
  ['car', 'automobile', 'motorcar'],
  ['cat', 'kitten', 'puss'], ['dog', 'hound', 'puppy', 'spaniel', 'canine'],
  ['horse', 'pony', 'stallion', 'mare', 'equestrian'],
  ['bird', 'avian'], ['flower', 'floral', 'bloom', 'bouquet'],
  ['door', 'doorway', 'portal'], ['window', 'casement'],
  ['room', 'interior', 'chamber'], ['ruin', 'ruined', 'ruins'],
  ['fire', 'burned', 'burnt', 'burning', 'afire'],
  ['gold', 'golden', 'gilt', 'gilded'], ['jewelry', 'jewellery'],
  ['armor', 'armour'], ['watercolor', 'watercolour'],
  ['photograph', 'photo'], ['painting', 'painted'],
  ['small', 'tiny', 'miniature'], ['storm', 'stormy', 'tempest', 'thunderstorm'],
  ['forest', 'woodland', 'woods'], ['sea', 'ocean'],
];
const IRREGULAR = { women: 'woman', men: 'man', children: 'child', mice: 'mouse', geese: 'goose', feet: 'foot', people: 'person' };
export function normalizeWord(word) {
  const value = word.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (IRREGULAR[value]) return IRREGULAR[value];
  if (value.length > 4 && /ies$/.test(value)) return value.slice(0, -3) + 'y';
  if (value.length > 4 && /(ches|shes|xes|zes|sses)$/.test(value)) return value.slice(0, -2);
  if (value.length > 3 && /s$/.test(value) && !/(ss|us|is)$/.test(value)) return value.slice(0, -1);
  return value;
}
const words = value => (value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]+/gu) ?? []).map(normalizeWord);
const synonyms = new Map();
for (const group of ALIASES) {
  const terms = [...new Set(group.map(normalizeWord))];
  for (const term of terms) synonyms.set(term, terms);
}
const FIELD_WEIGHTS = { title: 5.4, tags: 3.5, objectName: 2.65, classification: 2.15, medium: 1.75, creator: 1.05, culture: .95, period: .85, department: .55 };

export function parseTextQuery(text) {
  const positive = [], negative = [];
  let negate = false, alternative = false, previousNegative = false;
  for (const match of text.matchAll(/"([^"]+)"|[\p{L}\p{N}]+/gu)) {
    const raw = match[1] ?? match[0];
    const token = normalizeWord(raw);
    if (!match[1] && ['without', 'not', 'excluding', 'exclude'].includes(token)) { negate = true; continue; }
    if (!match[1] && (token === 'or' || token === 'and')) {
      negate = previousNegative;
      alternative = token === 'or' && !previousNegative;
      continue;
    }
    if (!match[1] && (STOP.has(token) || STOP.has(raw.toLowerCase()))) continue;
    const tokens = words(raw);
    if (!tokens.length) continue;
    const group = { terms: match[1] ? [tokens.join(' ')] : synonyms.get(token) ?? [token], phrase: Boolean(match[1]) };
    const target = negate ? negative : positive;
    if (alternative && target.length) {
      const previous = target.pop();
      target.push({ terms: [...new Set([...previous.terms, ...group.terms])], phrase: previous.phrase || group.phrase });
    } else target.push(group);
    previousNegative = negate;
    negate = false; alternative = false;
  }
  return { positive, negative };
}

export class RelevanceIndex {
  #postings = new Map();
  #records = new Map();
  constructor(documents) {
    for (const document of documents) {
      const fields = [], weighted = new Map();
      for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
        const value = field === 'tags' ? (document.tags ?? []).join(' ') : document[field] ?? '';
        const tokens = words(value);
        // A subject named by a short title is stronger evidence than a word
        // buried in a long series/publication credit (e.g. Gold Coin cards).
        const evidenceWeight = field === 'title' ? weight / (1 + .08 * Math.max(0, tokens.length - 1)) : weight;
        fields.push({ text: tokens.join(' '), weight: evidenceWeight });
        for (const token of new Set(tokens)) weighted.set(token, Math.max(weighted.get(token) ?? 0, evidenceWeight));
      }
      this.#records.set(document.id, { document, fields });
      for (const [token, weight] of weighted) {
        if (!this.#postings.has(token)) this.#postings.set(token, new Map());
        this.#postings.get(token).set(document.id, weight);
      }
    }
  }
  #groupHits(group) {
    const hits = new Map();
    for (const term of group.terms) {
      if (!term.includes(' ')) {
        for (const [id, weight] of this.#postings.get(term) ?? []) hits.set(id, Math.max(hits.get(id) ?? 0, weight));
      } else {
        const tokens = term.split(' ');
        for (const [id] of this.#postings.get(tokens[0]) ?? []) {
          const record = this.#records.get(id);
          for (const field of record.fields) {
            if (` ${field.text} `.includes(` ${term} `)) hits.set(id, Math.max(hits.get(id) ?? 0, field.weight));
          }
        }
      }
    }
    return hits;
  }
  search(text, filters) {
    const query = parseTextQuery(text);
    if (!query.positive.length) return { candidates: [], query };
    const groups = query.positive.map(group => this.#groupHits(group));
    // An unsupported noun cannot disappear just because another word matched.
    if (groups.some(group => group.size === 0)) return { candidates: [], query };
    const smallest = [...groups].sort((a,b) => a.size-b.size)[0];
    const excluded = new Set(query.negative.flatMap(group => [...this.#groupHits(group).keys()]));
    const candidates = [];
    for (const id of smallest.keys()) {
      const record = this.#records.get(id);
      if (excluded.has(id) || !groups.every(group => group.has(id)) || !matchesFilters(record.document, filters)) continue;
      // Absolute field evidence, not a normalized score that makes a weak
      // substring match look certain. Every required group already matched.
      const evidence = groups.reduce((sum, group) => sum + group.get(id) / FIELD_WEIGHTS.title, 0) / groups.length;
      candidates.push({ id, evidence });
    }
    return { candidates, query };
  }
}

function matchesFilters(document, filters = {}) {
  if (filters.ids?.length && !filters.ids.includes(document.id)) return false;
  if (filters.clusterIds?.length && !filters.clusterIds.includes(document.clusterId)) return false;
  for (const [key, field] of [['cultures','culture'], ['departments','department'], ['mediums','medium'], ['classifications','classification']]) {
    if (filters[key]?.length) {
      const actual = (document[field] ?? '').trim().toLowerCase();
      if (!actual || !filters[key].some(value => {
        const expected = value.trim().toLowerCase();
        return expected && actual.includes(expected);
      })) return false;
    }
  }
  if (typeof filters.yearBefore === 'number' && (document.year == null || document.year >= filters.yearBefore)) return false;
  if (typeof filters.yearAfter === 'number' && (document.year == null || document.year <= filters.yearAfter)) return false;
  return true;
}
