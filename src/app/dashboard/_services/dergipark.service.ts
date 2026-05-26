import { XMLParser } from "fast-xml-parser";
import { extractText } from "../_utils/xml-helpers";

export interface CandidatePaper {
  paperId: string;
  title: string;
  authors: string;
  year: string;
  url: string;
  abstract: string;
  source: "DergiPark" | "Semantic Scholar";
  lang: "TR" | "EN";
  citationCount?: number;
}

export class DergiParkService {
  /**
   * Fetches papers from DergiPark OAI-PMH XML API and filters them using Turkish keywords.
   */
  static async fetchDergiParkPapers(
    turkishKeywords: string[],
  ): Promise<CandidatePaper[]> {
    let dergiParkPapers: CandidatePaper[] = [];
    try {
      const dergiParkUrl = `https://dergipark.org.tr/api/public/oai/?verb=ListRecords&metadataPrefix=oai_dc`;
      const dpRes = await fetch(dergiParkUrl, {
        method: "GET",
      });

      console.log("[Teşhis - DergiPark OAI-PMH Status]:", dpRes.status);
      const dpXml = await dpRes.text();
      console.log(
        "[Teşhis - DergiPark OAI-PMH Response]:",
        dpXml.slice(0, 200),
      );

      if (dpRes.ok) {
        const parser = new XMLParser({ ignoreAttributes: false });
        const jsonObj = parser.parse(dpXml) as Record<string, unknown>;
        const oaiPmh = jsonObj["OAI-PMH"] as
          | Record<string, unknown>
          | undefined;
        const listRecords = oaiPmh?.ListRecords as
          | Record<string, unknown>
          | undefined;
        const records = listRecords?.record;

        if (Array.isArray(records) && records.length > 0) {
          const parsedRecords: CandidatePaper[] = records.map((recItem) => {
            const rec = recItem as Record<string, unknown>;
            const metadata = rec.metadata as
              | Record<string, unknown>
              | undefined;
            const dc = (metadata?.["oai_dc:dc"] || {}) as Record<
              string,
              unknown
            >;
            const titleText = extractText(dc["dc:title"]);
            const creators = dc["dc:creator"];
            const authors = Array.isArray(creators)
              ? creators.map((c) => extractText(c)).join(", ")
              : extractText(creators) || "Belirtilmemiş";

            const dateVal = extractText(dc["dc:date"]);
            const year = dateVal
              ? dateVal.split("-")[0]
              : new Date().getFullYear().toString();

            const identifiers = dc["dc:identifier"];
            let url = "";
            if (Array.isArray(identifiers)) {
              url =
                identifiers
                  .map((id) => extractText(id))
                  .find(
                    (s) => s.startsWith("http://") || s.startsWith("https://"),
                  ) || "";
            } else {
              url = extractText(identifiers);
            }
            if (!url) {
              url = `https://dergipark.org.tr/tr/pub/search?q=${encodeURIComponent(turkishKeywords.join(" "))}`;
            }

            const abstract = extractText(dc["dc:description"]);
            const header = rec.header as Record<string, unknown> | undefined;

            return {
              paperId: String(
                header?.identifier || Math.random().toString(36).substr(2, 9),
              ),
              title: titleText,
              authors,
              year,
              url,
              abstract,
              source: "DergiPark" as const,
              lang: "TR" as const,
            };
          });

          // In-memory filter using Turkish keywords
          const lowerKeywords = turkishKeywords.map((k) =>
            k.toLowerCase().trim(),
          );
          let filtered = parsedRecords.filter((rec: CandidatePaper) => {
            const titleLower = rec.title.toLowerCase();
            const abstractLower = rec.abstract.toLowerCase();
            return lowerKeywords.some(
              (kw) => titleLower.includes(kw) || abstractLower.includes(kw),
            );
          });

          // Fallback if filter leaves 0 records
          if (filtered.length === 0) {
            console.log(
              "[DergiParkService] OAI-PMH keyword match is empty, loading top 12 general records.",
            );
            filtered = parsedRecords.slice(0, 12);
          }

          dergiParkPapers = filtered;
          console.log(
            `[DergiParkService] Successfully processed ${dergiParkPapers.length} papers from DergiPark OAI-PMH.`,
          );
        }
      } else {
        console.error(
          "[Teşhis - DergiPark OAI-PMH Error XML/Text]:",
          dpXml.slice(0, 200),
        );
      }
    } catch (apiErr) {
      console.error("[Teşhis - DergiPark OAI-PMH Exception]:", apiErr);
    }

    return dergiParkPapers;
  }
}
