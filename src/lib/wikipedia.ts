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
 * Belirtilen teorisyen adını ve disiplin/bağlam anahtar kelimesini kullanarak
 * Wikipedia REST API üzerinden arama yapar ve en alakalı sayfa detaylarını döner.
 *
 * @param name - Arama yapılacak teorisyenin tam adı (Örn: "David Snow").
 * @param context - Teorisyenin ilişkilendirildiği bağlam veya disiplin (Örn: "sociology").
 * @returns En alakalı sayfanın başlık, açıklama, özet ve anahtar bilgilerini içeren nesne veya null.
 */
export async function searchWikipediaTheorist(
  name: string,
  context: string,
): Promise<{
  title: string;
  description: string;
  excerpt: string;
  key: string;
} | null> {
  try {
    const trimmedName = name.trim();
    const trimmedContext = context.trim();

    if (!trimmedName) {
      return null;
    }

    // Arama sorgusu oluşturuluyor (Örn: David Snow sociology)
    const query = `${trimmedName} ${trimmedContext}`.trim();
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
      console.error(
        `[Wikipedia Service] API error: ${response.status} ${response.statusText}`,
      );
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

    // Bağlama en uygun olan sayfayı bul (Açıklama veya özet içinde context kelimesi geçen ilk aday)
    const lowerContext = trimmedContext.toLowerCase();
    let bestMatch = candidates.find((page) => {
      const desc = (page.description || "").toLowerCase();
      const excerpt = (page.excerpt || "").toLowerCase();
      return desc.includes(lowerContext) || excerpt.includes(lowerContext);
    });

    // Eğer bağlam kelimesiyle doğrudan eşleşen bulunamazsa ilk adayı seç
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
    console.error("[Wikipedia Service] Error querying theorist page:", error);
    return null;
  }
}
