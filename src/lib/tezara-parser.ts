import * as cheerio from "cheerio";
import type { Logger } from "./logger";
import type { TezaraThesisDetails, TezaraThesisSummary } from "./types";

/**
 * Parses a Tezara thesis detail page HTML and returns structured thesis details.
 * Uses cheerio to extract metadata from the rendered page.
 *
 * @param html - Raw HTML of the detail page.
 * @param logger - Optional logger instance.
 * @returns A typed thesis details object, or null if parsing fails.
 */
export function parseTezaraDetails(
  html: string,
  logger?: Logger,
): TezaraThesisDetails | null {
  try {
    const $ = cheerio.load(html);
    const mainText = $("main").text();

    // Title from h1
    const title = $("h1").first().text().trim();
    if (!title) return null;

    // Tez No
    const tezNoMatch = mainText.match(/Tez No:\s*(\d+)/);
    if (!tezNoMatch) return null;
    const id = parseInt(tezNoMatch[1], 10);

    // Author
    const author =
      mainText.match(/Yazar:\s*(.*?)(?=Danışman)/)?.[1]?.trim() ?? "";

    // Thesis Type
    const thesisType =
      mainText.match(/Tez Türü:\s*(.*?)(?=Konular)/)?.[1]?.trim() ?? "";

    // Year
    const yearMatch = mainText.match(/Yıl:\s*(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;

    // University
    const university =
      mainText.match(/Üniversite:\s*(.*?)(?=Enstitü)/)?.[1]?.trim() ?? "";

    // Department (Ana Bilim Dalı)
    const department =
      mainText
        .match(/Ana Bilim Dalı:\s*(.*?)(?=Bilim Dalı:|Sayfa Sayısı|Özet)/)?.[1]
        ?.trim() ?? "";

    // Abstract
    const abstract =
      mainText
        .match(/Özet\s*([\s\S]*?)(?:Özet \(Çeviri\)|Benzer Tezler|$)/)?.[1]
        ?.trim() ?? "";

    // YÖK PDF URL
    const yokPdfUrl = $('a[href*="tez.yok.gov.tr/UlusalTezMerkezi/TezGoster"]')
      .first()
      .attr("href");

    return {
      id,
      title,
      author,
      university,
      year,
      thesisType,
      department,
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
 * Iterates over `<li id="thesis-...">` elements and extracts structured data.
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
        const title =
          titleLinks.length > 1 ? $(titleLinks[1]).text().trim() : "";
        if (!title) return;

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
          .find("span.icon-graduation-cap")
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
