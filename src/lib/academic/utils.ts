export { extractCleanDoi, extractOpenAlexId } from "./identifier-utils";

export {
  formatAuthorName,
  formatAuthorList,
  extractCrossrefYear,
  type CrossrefPerson,
} from "./crossref-utils";

export {
  stripAltTitle,
  areTitlesSimilar,
  areTitlesDuplicateByMetric,
  jaccardSimilarity,
  normalizedLevenshteinSimilarity,
  levenshteinDistance,
  normalizeTitle,
  normalizeCleanTitle,
} from "./title-utils";

export {
  toAsciiAlphanumeric,
  extractSurname,
  formatApaPdfFileName,
} from "./filename-utils";

export { formatPageNumber, cleanPageNumberInput } from "./page-utils";

export { resolveAbstractInvertedIndex } from "./abstract-utils";

export { sortLibraryResources } from "./sorting-utils";

export { cleanAbstractPrefix } from "./abstract-cleaner";
export {
  formatResourceAuthors,
  formatAuthorDisplayString,
  type FormatAuthorOptions,
} from "./author-formatter";
export {
  parseDualSemanticQuery,
  serializeDualSemanticQuery,
  type DualSemanticQuery,
} from "./query-utils";
export { isBookReview, isNonResearchEvent } from "./book-review-utils";
