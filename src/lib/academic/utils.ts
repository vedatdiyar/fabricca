export { extractCleanDoi, extractOpenAlexId } from "./identifier-utils";

export {
  formatAuthorName,
  formatAuthorList,
  extractCrossrefYear,
  type CrossrefPerson,
} from "./crossref-utils";

export {
  stripAltTitle,
  containmentSimilarity,
  areTitlesSimilar,
  normalizeTitle,
  normalizeCleanTitle,
} from "./title-utils";

export {
  toAsciiWord,
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
