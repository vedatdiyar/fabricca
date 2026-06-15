import type { Logger } from "./logger";

/**
 * Wikipedia Arama Sonucu Öğe Arayüzü.
 */
interface WikipediaPage {
  id: number;
  key: string;
  title: string;
  excerpt: string;
  matched_title: string | null;
  description: string | null;
}

/**
 * Wikipedia Arama API Yanıt Arayüzü.
 */
interface WikipediaSearchResponse {
  pages: WikipediaPage[];
}

/**
 * Belirtilen teorisyen adını kullanarak İngilizce Wikipedia REST API üzerinden
 * Hibrit Doğrulama (Hybrid Verification) modeliyle arama yapar.
 *
 * Doğrulama 4 aşamalı bir kademe (cascade) ile çalışır:
 *   1. Katı Başlık Eşleşmesi — title, aranan name ile birebir eşleşirse doğrudan onay.
 *   2. Akademik Unvan Süzgeci — description/excerpt/title içinde sociologist,
 *      philosopher, academic, theorist, professor, scholar unvanlarını ara.
 *   3. Konsept/Atıf Süzgeci — excerpt içinde teorisyenin soyadı/tam adını ara
 *      (müstakil sayfası olmayıp konsept sayfalarında adı geçenleri yakalar).
 *   4. Yedek — hiçbir eşleşme bulunamazsa ilk adayı döndür.
 *
 * @param name - Arama yapılacak teorisyenin tam adı (Örn: "David Snow").
 * @param _context - Geriye dönük uyumluluk için korunmuş parametre (kullanılmaz).
 * @param logger - Opsiyonel Logger instance'ı (hata logları için).
 * @returns En alakalı sayfanın başlık, açıklama, özet ve anahtar bilgilerini içeren nesne veya null.
 */
export async function searchWikipediaTheorist(
  name: string,
  _context: string,
  logger?: Logger,
): Promise<{
  title: string;
  description: string;
  excerpt: string;
  key: string;
} | null> {
  try {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    // Arama sorgusu oluşturuluyor (Örn: "David Snow academic")
    const query = `${trimmedName} academic`;
    const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(
      query,
    )}&limit=10`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "FabriccaAcademicAssistant/1.0 (contact@fabricca.com)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      logger?.error("search_filtered", {
        service: "wikipedia",
        step: "theorist_api_error",
        error: new Error(
          `Wikipedia API error: ${response.status} ${response.statusText}`,
        ),
        data: { name },
      });
      return null;
    }

    const data = (await response.json()) as WikipediaSearchResponse;

    if (!data || !Array.isArray(data.pages) || data.pages.length === 0) {
      return null;
    }

    // Yönlendirme/Disambiguation sayfalarını filtrele
    const candidates = data.pages.filter((page) => {
      const pageTitle = page.title.toLowerCase();
      const pageDesc = (page.description || "").toLowerCase();
      const pageExcerpt = (page.excerpt || "").toLowerCase();

      const isDisambiguation =
        pageTitle.includes("(disambiguation)") ||
        pageDesc.includes("disambiguation page") ||
        pageDesc.includes("disambiguation") ||
        pageExcerpt.includes("disambiguation page") ||
        pageExcerpt.includes("disambiguation");

      return !isDisambiguation;
    });

    if (candidates.length === 0) {
      return null;
    }

    const normalizedName = trimmedName.toLowerCase();

    // Aşama 1 — Katı Başlık Eşleşmesi: title name ile birebir örtüşüyorsa
    // unvan süzgecine bakmaksızın doğrudan onaylayıp döndür.
    const exactTitleMatch = candidates.find(
      (page) => page.title.toLowerCase() === normalizedName,
    );
    if (exactTitleMatch) {
      const cleanExcerpt = exactTitleMatch.excerpt
        ? exactTitleMatch.excerpt.replace(/<\/?[^>]+(>|$)/g, "")
        : "";
      return {
        title: exactTitleMatch.title || "",
        description: exactTitleMatch.description || "",
        excerpt: cleanExcerpt,
        key: exactTitleMatch.key || "",
      };
    }

    // Aşama 2 — Akademik unvan süzgeci: sociologist, philosopher, academic, theorist, professor, scholar
    const ACADEMIC_TITLES = [
      "sociologist", "philosopher", "academic", "theorist",
      "professor", "scholar",
    ];
    let bestMatch = candidates.find((page) => {
      const haystack = [
        (page.description || "").toLowerCase(),
        (page.excerpt || "").toLowerCase(),
        page.title.toLowerCase(),
      ].join(" ");
      return ACADEMIC_TITLES.some((title) => haystack.includes(title));
    });

    // Aşama 3 — Konsept/Atıf Süzgeci: excerpt içinde teorisyenin soyadı/tam adı
    // geçen akademik konsept sayfalarını geçerli eşleşme olarak kabul et.
    if (!bestMatch) {
      const nameParts = trimmedName.split(" ");
      const surname = nameParts.length > 1
        ? nameParts[nameParts.length - 1].toLowerCase()
        : normalizedName;

      bestMatch = candidates.find((page) => {
        const cleanExcerpt = (page.excerpt || "")
          .replace(/<\/?[^>]+(>|$)/g, "")
          .toLowerCase();
        return cleanExcerpt.includes(surname) || cleanExcerpt.includes(normalizedName);
      });
    }

    // Aşama 4 — Yedek: hiçbir şey bulunamazsa ilk adayı seç
    if (!bestMatch) {
      bestMatch = candidates[0];
    }

    // HTML etiketlerini (örneğin <span class="searchmatch">) temizle
    const cleanExcerpt = bestMatch.excerpt
      ? bestMatch.excerpt.replace(/<\/?[^>]+(>|$)/g, "")
      : "";

    return {
      title: bestMatch.title || "",
      description: bestMatch.description || "",
      excerpt: cleanExcerpt,
      key: bestMatch.key || "",
    };
  } catch (error) {
    logger?.error("search_filtered", {
      service: "wikipedia",
      step: "theorist_search_failed",
      error,
      data: { name },
    });
    return null;
  }
}
