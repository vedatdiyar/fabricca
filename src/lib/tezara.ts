import { z } from "zod";

/**
 * Tezara Tez Özet Arama Sonucu.
 */
export interface TezaraThesisSummary {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
}

/**
 * Tezara Tez Detay Arayüzü (Özet Seçim Kuralı uyarınca tek bir özet barındırır).
 */
export interface TezaraThesisDetails {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  abstract: string;
}

/**
 * RSC stream formatındaki T[hash] referanslı metin bloklarını ayıklar.
 *
 * @param text - RSC ham yanıt metni
 * @returns Referans kimliği -> metin eşleşmesi
 */
export function extractRscTexts(text: string): Record<string, string> {
  const refMap: Record<string, string> = {};
  const regex = /\b([a-fA-F0-9]+):T([a-zA-Z0-9]+),/g;
  const matches: {
    id: string;
    type: string;
    index: number;
    contentStart: number;
  }[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      id: match[1],
      type: match[2],
      index: match.index,
      contentStart: regex.lastIndex,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const end = next ? next.index : text.length;
    let content = text.substring(current.contentStart, end);

    const cleanMatch = content.match(
      /^([\s\S]*?)(?=\b[a-fA-F0-9]+:(?:I|\[|{|"|\$))/,
    );
    if (cleanMatch) {
      content = cleanMatch[1];
    }
    refMap[current.id] = content.trim();
  }
  return refMap;
}

/**
 * Arama sayfasından dönen RSC stream verisinden tez listesini ayıklar.
 *
 * @param text - RSC ham arama yanıt metni
 * @returns Tez özet nesneleri dizisi
 */
export function parseRscTheses(text: string): TezaraThesisSummary[] {
  const lines = text.split("\n");
  const results: TezaraThesisSummary[] = [];

  for (const line of lines) {
    if (!line.includes("searchTheses")) continue;

    const startIdx = line.indexOf('{"state":');
    if (startIdx === -1) continue;

    const endIdx = line.lastIndexOf("}");
    if (endIdx === -1) continue;

    const jsonStr = line.substring(startIdx, endIdx + 1);
    try {
      const stateObj = JSON.parse(jsonStr) as {
        state?: {
          queries?: {
            queryKey?: unknown[];
            state?: {
              data?: {
                json?: {
                  hits?: Record<string, unknown>[];
                };
              };
            };
          }[];
        };
      };

      const queries = stateObj.state?.queries || [];
      for (const q of queries) {
        if (Array.isArray(q.queryKey) && q.queryKey[0] === "searchTheses") {
          const hits = q.state?.data?.json?.hits || [];
          for (const hit of hits) {
            results.push({
              id: Number(hit.id || 0),
              title: String(hit.title_original || hit.title_translated || ""),
              author: String(hit.author || ""),
              university: String(hit.university || ""),
              year: Number(hit.year || 0),
              thesisType: String(hit.thesis_type || ""),
              department: String(hit.department || ""),
            });
          }
        }
      }
    } catch (err) {
      console.error("[Tezara Parser] Liste çözümleme hatası:", err);
    }
  }

  return results;
}

/**
 * Tezara üzerinden tekil sayfa bazlı arama gerçekleştirir.
 *
 * @param query - İngilizce çapraz arama sorgusu
 * @param page - Sayfa numarası
 * @returns Bulunan tezlerin listesi
 */
export async function searchTezaraPage(
  query: string,
  page: number,
): Promise<TezaraThesisSummary[]> {
  try {
    const url = `https://tezara.org/search?q=${encodeURIComponent(query)}&page=${page}&_rsc=vusbg`;
    const response = await fetch(url, {
      headers: {
        rsc: "1",
        accept: "text/x-component",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.warn(
        `[Tezara Search] HTTP Hatası: ${response.status} ${response.statusText}`,
      );
      return [];
    }

    const text = await response.text();
    return parseRscTheses(text);
  } catch (err) {
    console.error("[Tezara Search] Arama hatası:", err);
    return [];
  }
}

/**
 * İngilizce çapraz arama sorgusu ile Tezara'yı 2 sayfa limitli olarak tarar.
 * İlk sayfada 20'den az veri gelirse sayfa 2 taranmaz.
 *
 * @param query - İngilizce çapraz arama sorgusu
 * @returns Çakışan tezlerin listesi (Maksimum 40 adet)
 */
export async function searchTezara(
  query: string,
): Promise<TezaraThesisSummary[]> {
  console.log(`[Tezara Engine] Sorgu aranıyor: "${query}"`);

  // 1. Sayfa Arama
  const page1Results = await searchTezaraPage(query, 1);
  console.log(`[Tezara Engine] 1. Sayfa Sonuç Adedi: ${page1Results.length}`);

  if (page1Results.length < 20) {
    console.log(
      "[Tezara Engine] 1. sayfada 20'den az sonuç geldi, 2. sayfa taranmıyor.",
    );
    return page1Results;
  }

  // 2. Sayfa Arama
  const page2Results = await searchTezaraPage(query, 2);
  console.log(`[Tezara Engine] 2. Sayfa Sonuç Adedi: ${page2Results.length}`);

  return [...page1Results, ...page2Results].slice(0, 40);
}

/**
 * Tekil tez detaylarını RSC formatında çekip özet ve metadata bilgilerini ayrıştırır.
 * Özet Seçim Kuralı gereğince Türkçe/İngilizce bloklardan yalnızca ilk karşılaşılanı alınır, diğeri yoksayılır.
 *
 * @param id - Tez numarası (ID)
 * @returns Tez detayları nesnesi veya hata durumunda null
 */
export async function fetchThesisDetails(
  id: number,
): Promise<TezaraThesisDetails | null> {
  try {
    const url = `https://tezara.org/theses/${id}?_rsc=vusbg`;
    const response = await fetch(url, {
      headers: {
        rsc: "1",
        accept: "text/x-component",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.warn(
        `[Tezara Details] Detay çekilemedi (${id}): ${response.status}`,
      );
      return null;
    }

    const text = await response.text();
    const refMap = extractRscTexts(text);

    let thesisObj: Record<string, any> | null = null;
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.includes("title_original") && line.includes('"thesis":{')) {
        const startIdx =
          line.indexOf('{"thesis":') !== -1
            ? line.indexOf('{"thesis":')
            : line.indexOf('{"id":');
        if (startIdx === -1) continue;

        let braceCount = 0;
        let endIdx = -1;
        for (let i = startIdx; i < line.length; i++) {
          if (line[i] === "{") braceCount++;
          else if (line[i] === "}") {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
          }
        }

        if (endIdx !== -1) {
          const jsonStr = line.substring(startIdx, endIdx + 1);
          try {
            const parsedJson = JSON.parse(jsonStr) as Record<string, any>;
            thesisObj = (parsedJson.thesis || parsedJson) as Record<
              string,
              any
            >;
            break;
          } catch (err) {
            // Hata durumunda diğer satırları denemeye devam et
          }
        }
      }
    }

    if (!thesisObj) {
      return null;
    }

    // Özet Seçim Kuralı: İlk karşılaşılan bütünsel özet bloğunu al, ikinciyi pas geç.
    let abstract = "";
    if (
      thesisObj.abstract_original &&
      thesisObj.abstract_original.startsWith("$")
    ) {
      const refId = thesisObj.abstract_original.substring(1);
      abstract = refMap[refId] || "";
    }

    if (
      !abstract &&
      thesisObj.abstract_translated &&
      thesisObj.abstract_translated.startsWith("$")
    ) {
      const refId = thesisObj.abstract_translated.substring(1);
      abstract = refMap[refId] || "";
    }

    return {
      id: Number(thesisObj.id || id),
      title: String(
        thesisObj.title_original || thesisObj.title_translated || "",
      ),
      author: String(thesisObj.author || ""),
      university: String(thesisObj.university || ""),
      year: Number(thesisObj.year || 0),
      thesisType: String(thesisObj.thesis_type || ""),
      department: String(thesisObj.department || ""),
      abstract,
    };
  } catch (err) {
    console.error(`[Tezara Details] Tez detay alma hatası (${id}):`, err);
    return null;
  }
}
