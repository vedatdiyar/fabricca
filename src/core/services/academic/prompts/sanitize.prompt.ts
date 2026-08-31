import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

export interface SanitizeItemInput {
  title: string;
  author: string;
}

/**
 * Builds the standardized PromptPayload for academic title/author sanitization.
 *
 * @param items - Array of title/author objects to sanitize.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildSanitizePromptPayload(
  items: SanitizeItemInput[],
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Akademik yayın başlıklarını ve yazar isimlerini APA başlık standartlarına ve Türkçe imla kurallarına göre standardize eden veri düzenleme uzmanısınız.",

    primaryTask:
      "Girdi dizisindeki (array) her bir akademik nesnenin `title` ve `author` alanlarını belirtilen kurallara göre standardize edip JSON formatında döndürün.",

    rulesAndConstraints: `- **Başlık Biçimlendirmesi (Title Case):** Bağlaçlar (of, and, the, for, in, to, with, a, an, at, by, from, on, via, versus, vs, nor, or, so, than, up, upon, within, without) hariç her kelimenin ilk harfini büyük yapın.
- **Bölüm Numarası ve İndeks Temizliği:** Kitap veya el kitabı bölümlerinin başındaki gereksiz rakamsal veya metinsel bölüm ön eklerini (ör. "14. Textual Analysis" → "Textual Analysis", "Chapter 5: Discourse Analysis" → "Discourse Analysis", "Bölüm 2 - Söylem Kuramları" → "Söylem Kuramları") temizleyin ve asıl başlığı muhafaza edin. Tarihsel yılları (ör. "1990-1999 Dönemi...") ve bilimsel terimleri (ör. "3D...") koruyun.
- **Kısaltmaları Koruma:** Bilinen kısaltmaları olduğu gibi koruyun: DOI, LLM, YOK, IMF, NATO, UNESCO, WHO, EU, UN, USA, UK, ABD, AB, TBMM, TUBITAK, TKI, RNA, DNA, PCR, CRISPR.
- **Latince Terimler:** Latince bilimsel terimleri (Homo sapiens, in vitro, in vivo, et al.) standart biyolojik cins/tür yazımına göre düzeltin.
- **Yazar İsimleri:** Yazar isimlerini Proper Case formatına çevirin (ör. "AHMET YILMAZ" → "Ahmet Yılmaz").
- **Türkçe Karakter Düzeltme:** İngilizce karakter setine düşmüş Türkçe isim ve başlıkları doğru Türkçe karakterlerle düzeltin.
- **Karakter Temizliği:** Başlık sonlarındaki dipnot veya asterisk (*) işaretlerini temizleyin.`,

    outputFormat:
      "Girdideki nesnelerin sırasını bozmadan standardize edilmiş `title` ve `author` alanlarını içeren JSON nesnesi döndürün. Şema: [{\"title\": string, \"author\": string}]",

    inputContext: `Aşağıdaki dizide yer alan nesnelerin title ve author alanlarını kurallara uygun biçimde düzenleyin:\n\n${JSON.stringify(
      items,
      null,
      2,
    )}`,

    taskTrigger:
      "Yukarıdaki <context> içinde verilen akademik yayınların başlık ve yazar bilgilerini <instructions> kurallarına göre standardize ederek aynı sırada JSON dizisi olarak üret.",
  });
}
