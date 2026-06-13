/**
 * Parsed literature object containing author, title, and year.
 */
interface ParsedLiterature {
  author: string;
  title: string;
  year: string;
}

/**
 * Result of the literature verification check.
 */
export interface VerificationResult {
  verified: boolean;
  method: "Google Books" | "Wikipedia (Fallback)" | "None";
}

/**
 * Interface representing a page returned by Wikipedia search.
 */
interface WikipediaSearchPage {
  id?: number;
  key?: string;
  title: string;
  excerpt?: string;
  matched_title?: string | null;
  description?: string | null;
}

/**
 * Parses a literature reference string in APA/custom format into author, title, and year.
 * Recommended format: "Surname, Initial. (Year). Book Title"
 *
 * @param lit - The raw literature reference string.
 * @returns The parsed literature object.
 */
export function parseLiteratureString(lit: string): ParsedLiterature {
  const regex = /^([^(]+)\((\d{4})\)\.?\s*(.+)$/;
  const match = lit.match(regex);
  if (match) {
    const authorRaw = match[1].trim();
    const year = match[2].trim();
    let title = match[3].trim();
    if (title.endsWith(".")) {
      title = title.substring(0, title.length - 1).trim();
    }
    const author = authorRaw.split(",")[0].trim();
    return { author, title, year };
  }
  return { author: "", title: lit, year: "" };
}

/**
 * Queries Google Books API to verify the existence of a book/publication.
 *
 * @param title - The title of the publication.
 * @param author - The author of the publication.
 * @returns A promise that resolves to true if the book is found, false otherwise.
 */
async function searchGoogleBooks(title: string, author?: string): Promise<boolean> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return false;

  const cleanTitle = title.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
  let query = `intitle:${encodeURIComponent(cleanTitle)}`;
  if (author) {
    const cleanAuthor = author.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    query += `+inauthor:${encodeURIComponent(cleanAuthor)}`;
  }

  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&key=${apiKey}&maxResults=1`;
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return false;
    const data = await response.json();
    return !!(data.items && data.items.length > 0);
  } catch (err) {
    return false;
  }
}

/**
 * Queries Wikipedia search API to verify a publication as a fallback option.
 * Applies stop-words filtering and enforces a minimum 50% keyword match.
 *
 * @param title - The title of the publication.
 * @param author - The author of the publication.
 * @returns A promise that resolves to true if a match is found on Wikipedia, false otherwise.
 */
async function searchWikipediaPublication(title: string, author?: string): Promise<boolean> {
  const cleanTitle = title.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
  const query = author ? `${author} ${cleanTitle}` : cleanTitle;
  const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=3`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "FabriccaAcademicAssistant/1.0 (contact@fabricca.com)",
        Accept: "application/json",
      },
    });
    if (!response.ok) return false;
    const data = await response.json();
    const pages = data.pages as WikipediaSearchPage[] | undefined;
    if (!pages || pages.length === 0) return false;

    const stopWords = new Set([
      "title", "book", "author", "journal", "press", "university",
      "edition", "series", "paper", "articles", "studies", "research",
      "hakkında", "üzerine", "kitap", "makale", "yayın", "dergi"
    ]);
    const keywords = cleanTitle.toLowerCase().split(/\s+/)
      .map(w => w.replace(/[^\w]/g, ""))
      .filter(w => w.length > 4 && !stopWords.has(w));

    if (keywords.length === 0) return false;

    return pages.some((page) => {
      const pageTitle = (page.title || "").toLowerCase();
      const pageDesc = (page.description || "").toLowerCase();
      const pageExcerpt = (page.excerpt || "").toLowerCase();

      const matchCount = keywords.filter(kw =>
        pageTitle.includes(kw) || pageDesc.includes(kw) || pageExcerpt.includes(kw)
      ).length;

      const requiredMatches = keywords.length === 1 ? 1 : Math.max(2, Math.ceil(keywords.length * 0.5));
      return matchCount >= requiredMatches;
    });
  } catch (err) {
    return false;
  }
}

/**
 * Main function to verify a literature citation using Google Books and Wikipedia fallback.
 *
 * @param lit - The raw literature string to verify.
 * @returns A promise resolving to a VerificationResult object.
 */
export async function verifyLiterature(lit: string): Promise<VerificationResult> {
  const { author, title } = parseLiteratureString(lit);

  const foundInBooks = await searchGoogleBooks(title, author);
  if (foundInBooks) {
    return { verified: true, method: "Google Books" };
  }

  const foundInWiki = await searchWikipediaPublication(title, author);
  if (foundInWiki) {
    return { verified: true, method: "Wikipedia (Fallback)" };
  }

  return { verified: false, method: "None" };
}
