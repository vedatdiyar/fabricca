import type { QueryDecomposition, SearchChip } from "./schemas";
import type { DiscoveryResults } from "./discovery";

/**
 * Builds UI search chips from queries and discovery results.
 *
 * @param queries - Decomposed queries.
 * @param discovery - Discovery results.
 * @returns Search chips for UI.
 */
export function buildSearchChips(
  queries: QueryDecomposition,
  discovery: DiscoveryResults,
): SearchChip[] {
  const chips: SearchChip[] = [];

  queries.webQueries.forEach((q, idx) => {
    const count = discovery.webResultsArray[idx]?.length ?? 0;
    chips.push({
      id: `web-${idx}`,
      query: q,
      channel: "web",
      label: "Web & Rapor",
      resultCount: count,
    });
  });

  queries.thesisQueries.forEach((q, idx) => {
    const count = discovery.thesisResultsArray[idx]?.length ?? 0;
    chips.push({
      id: `thesis-${idx}`,
      query: q,
      channel: "thesis",
      label: "YÖK Tez Arşivi",
      resultCount: count,
    });
  });

  queries.literatureQueries.forEach((q, idx) => {
    const count = discovery.litResultsArray[idx]?.length ?? 0;
    chips.push({
      id: `lit-${idx}`,
      query: q,
      channel: "literature",
      label: "Uluslararası Literatür",
      resultCount: count,
    });
  });

  return chips;
}

/**
 * Builds evidence summary text for audit prompt.
 *
 * @param queries - Decomposed queries.
 * @param discovery - Discovery results.
 * @returns Evidence summary string.
 */
export function buildEvidenceSummary(
  queries: QueryDecomposition,
  discovery: DiscoveryResults,
): string {
  const evidenceLines: string[] = [];

  discovery.webResultsArray.forEach((results, qIdx) => {
    evidenceLines.push(
      `[Web Arama ${qIdx + 1}: "${queries.webQueries[qIdx]}"]`,
    );
    results.forEach((r) => {
      evidenceLines.push(
        `- ${r.title} (${r.url}): ${(r.highlights ?? []).slice(0, 2).join(" ")}`,
      );
    });
  });

  discovery.thesisResultsArray.forEach((results, qIdx) => {
    evidenceLines.push(
      `[YÖK Tez Araması ${qIdx + 1}: "${queries.thesisQueries[qIdx]}"]`,
    );
    results.forEach((t) => {
      evidenceLines.push(
        `- Başlık: ${t.title} | Üniversite: ${t.university ?? "Belirtilmemiş"} (${t.year ?? "Yıl Yok"}) | Özet: ${(t.abstract ?? "").slice(0, 250)}...`,
      );
    });
  });

  discovery.litResultsArray.forEach((results, qIdx) => {
    evidenceLines.push(
      `[Uluslararası Literatür ${qIdx + 1}: "${queries.literatureQueries[qIdx]}"]`,
    );
    results.forEach((p) => {
      evidenceLines.push(
        `- Başlık: ${p.title ?? "İsimsiz"} | Atıf: ${p.citedByCount ?? 0} | Yazarlar: ${(p.authors ?? []).slice(0, 3).join(", ")}`,
      );
    });
  });

  return evidenceLines.join("\n");
}
