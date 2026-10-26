type SearchableProduct = {
  name: string;
  sku: string;
  short_description: string | null;
  brandName: string | null;
  categoryName: string | null;
  tags: string[];
};

const stopWords = new Set(["a", "an", "the", "for", "with", "and", "or", "of", "to", "product", "item"]);
const synonymGroups = [
  ["bulb", "bulbs", "lamp", "lamps", "lightbulb"],
  ["wire", "wires", "cable", "cables"],
  ["socket", "sockets", "outlet", "outlets", "receptacle"],
  ["switch", "switches", "isolator", "isolators"],
  ["breaker", "breakers", "mcb", "mcbs", "circuitbreaker"],
  ["solar", "pv", "photovoltaic", "photovoltaics"],
  ["battery", "batteries", "accumulator", "accumulators"],
];
const synonyms = new Map<string, Set<string>>();

for (const group of synonymGroups) {
  const terms = new Set(group);
  for (const term of group) synonyms.set(term, terms);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function differsByAtMostOneCharacter(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1 || left === right) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let differences = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    differences += 1;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  return differences + Number(leftIndex < left.length || rightIndex < right.length) <= 1;
}

function tokenMatchScore(token: string, terms: string[], exactScore: number, synonymScore: number, typoScore: number) {
  if (terms.includes(token)) return exactScore;
  const tokenSynonyms = synonyms.get(token);
  if (tokenSynonyms && terms.some((term) => tokenSynonyms.has(term))) return synonymScore;
  if (token.length >= 5 && terms.some((term) => term.length >= 5 && differsByAtMostOneCharacter(token, term))) {
    return typoScore;
  }
  return 0;
}

export function scoreProductMatch(product: SearchableProduct, query: string) {
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(product.name);
  const normalizedSku = normalize(product.sku);
  if (normalizedQuery && (normalizedQuery === normalizedName || normalizedQuery === normalizedSku)) return 1;

  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1 && !stopWords.has(token));
  if (!queryTokens.length) return 0;

  const nameTerms = normalizedName.split(" ");
  const skuTerms = normalizedSku.split(" ");
  const brandTerms = normalize(product.brandName ?? "").split(" ");
  const categoryTerms = normalize(product.categoryName ?? "").split(" ");
  const descriptionTerms = normalize(`${product.short_description ?? ""} ${product.tags.join(" ")}`).split(" ");
  const score = queryTokens.reduce((total, token) => {
    return total + Math.max(
      tokenMatchScore(token, skuTerms, 1, 0.88, 0.78),
      tokenMatchScore(token, nameTerms, 0.95, 0.82, 0.72),
      tokenMatchScore(token, brandTerms, 0.78, 0.68, 0.58),
      tokenMatchScore(token, categoryTerms, 0.65, 0.58, 0.48),
      tokenMatchScore(token, descriptionTerms, 0.48, 0.42, 0.35),
    );
  }, 0);

  return Math.min(1, score / queryTokens.length);
}
