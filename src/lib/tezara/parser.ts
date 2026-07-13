import * as cheerio from "cheerio";
import type { Logger } from "../logger";
import type { TezaraThesisSummary } from "../types";

/**
 * Parses a Tezara thesis detail page HTML and extracts abstract and YÖK PDF URL.
 * Uses a regex pattern for the abstract section and a CSS selector for the PDF link.
 *
 * @param html - Raw HTML of the detail page.
 * @param id - The thesis ID (passthrough, unused in extraction but documents provenance).
 * @param logger - Optional logger instance.
 * @returns An object with abstract and optional yokPdfUrl, or null if the page structure is invalid.
 */
export function parseTezaraDetails(
  html: string,
  id: number,
  logger?: Logger,
): { abstract: string; yokPdfUrl?: string } | null {
  try {
    const $ = cheerio.load(html);
    const mainText = $("main").text();

    if (!mainText) return null;

    // Abstract — fallback zinciri ile akıllı ayıklama
    let abstract = "";
    const tryExtract = (pattern: RegExp): string =>
      mainText.match(pattern)?.[1]?.trim() ?? "";

    // 1. Adım: Mevcut regex ile dene
    abstract = tryExtract(
      /Özet\s*([\s\S]*?)(?:Özet \(Çeviri\)|Benzer Tezler|$)/,
    );

    // 2. Adım: Sonuç geçersizse ("Özet yok.", <10 karakter, boş) Fallback 1
    const isJunk =
      !abstract || abstract.length < 10 || /^Özet yok\.?$/i.test(abstract);
    if (isJunk) {
      abstract = tryExtract(/Özet \(Çeviri\)\s*([\s\S]*?)(?:Benzer Tezler|$)/);
    }

    // 3. Adım: Hâlâ geçersizse Fallback 2 — ham metni temizle
    if (!abstract || abstract.length < 10) {
      abstract = tryExtract(/Özet\s*([\s\S]*?)(?:Benzer Tezler|$)/)
        .replace(/^Özet yok\.?\s*/i, "")
        .trim();
    }

    if (!abstract) {
      logger?.warn("tezara_parse_selector_miss", {
        service: "tezara",
        data: { field: "abstract", thesisId: id },
      });
    }

    // YÖK PDF URL — CSS selector korunuyor
    const yokPdfLink = $(
      'a[href*="tez.yok.gov.tr/UlusalTezMerkezi/TezGoster"]',
    ).first();
    const yokPdfUrl = yokPdfLink.attr("href");
    if (!yokPdfUrl) {
      logger?.warn("tezara_parse_selector_miss", {
        service: "tezara",
        data: { field: "yokPdfUrl", thesisId: id },
      });
    }

    return {
      abstract,
      yokPdfUrl,
    };
  } catch (err) {
    logger?.error("parser_detail_failed", {
      service: "tezara",
      data: { context: "parseTezaraDetails" },
      error: err,
    });
    return null;
  }
}

/**
 * Parses a Tezara search results page HTML and returns an array of thesis summaries.
 * Iterates over `<li id="thesis-...">` elements and extracts structured data
 * using stable CSS selectors.
 *
 * @param html - Raw HTML of the search results page.
 * @param logger - Optional logger instance.
 * @returns A list of typed thesis summary objects.
 */
export function parseTezaraSearchResults(
  html: string,
  logger?: Logger,
): TezaraThesisSummary[] {
  const results: TezaraThesisSummary[] = [];

  try {
    const $ = cheerio.load(html);

    $('li[id^="thesis-"]').each((_, el) => {
      try {
        const $li = $(el);
        const idStr = $li.attr("id")?.replace("thesis-", "");
        const id = parseInt(idStr ?? "", 10);
        if (!id) return;

        // Title is the second a[href^="/theses/"] in the li (first is the Tez No link)
        const titleLinks = $li.find('a[href^="/theses/"]');
        const titleLink = titleLinks.length > 1 ? $(titleLinks[1]) : null;
        let title = titleLink ? titleLink.text().trim() : "";
        if (!title) return;

        const altTitle = titleLink
          ? titleLink.next("p").first().text().trim()
          : "";
        if (altTitle) {
          title = `${title} / ${altTitle}`;
        }

        // Author
        const author = $li
          .find("span.icon-pen-tool")
          .first()
          .parent()
          .text()
          .trim();

        // University
        const university = $li
          .find('a[href^="/universities/"]')
          .first()
          .text()
          .trim();

        // Year
        const yearText = $li
          .find("span.icon-calendar")
          .first()
          .parent()
          .text()
          .trim();
        const year = parseInt(yearText, 10) || 0;

        // Thesis Type
        const thesisType = $li
          .find("span.icon-graduation-cap, span.icon-trophy")
          .first()
          .parent()
          .text()
          .trim();

        // Department
        const department = $li
          .find("span.icon-building")
          .first()
          .parent()
          .text()
          .trim();

        results.push({
          id,
          title,
          author,
          university,
          year,
          thesisType,
          department,
        });
      } catch {
        // Skip individual item errors
      }
    });
  } catch (err) {
    logger?.error("parser_search_failed", {
      service: "tezara",
      data: { context: "parseTezaraSearchResults" },
      error: err,
    });
  }

  return results;
}
