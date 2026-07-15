import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const litKeywordExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    turkishQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖKTEZ veritabanında Türkçe dizinlenmiş tezleri bulmak için en uygun 3 ila 4 adet Türkçe akademik arama sorgusu.",
    },
    englishQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖKTEZ veritabanında İngilizce dizinlenmiş tezleri bulmak için en uygun 3 ila 4 adet İngilizce akademik arama sorgusu.",
    },
  },
  required: ["turkishQueries", "englishQueries"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildLitKeywordExtractionSystemInstruction(): string {
  return `<constraints>
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanmalısınız.
- Bilgi kesim tarihiniz Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı temel almalısınız.
- KATI SORGULAR KİLİDİ: turkishQueries listesi en az 3, en fazla 4 eleman içermelidir. englishQueries listesi en az 3, en fazla 4 eleman içermelidir.
- SORGULARIN YAPISI: Her bir sorgu, 2 ila 4 kelimeden oluşan doğal akademik tamlamalar veya kavram grupları olmalıdır. Özel karakter veya tırnak işareti kullanmayınız.
- TÜRKÇE KARAKTER KURALI: Türkçe sorgular üretilirken Türkçe karakterleri (ç, ğ, ı, ö, ş, ü, â) KESİNLİKLE aynen koruyunuz. İngilizce karakterlere dönüştürmeyiniz (Örn: "kürt", "söylem", "kopuş", "dönüşüm" olarak yazılmalıdır; "kurt", "soylem" vb. yazılması kesinlikle yasaktır).
- TAMLAMA SERBESTLİĞİ: Türkçe sorgularda kelimeleri en yalın kök hallerine (lemma) indirgemek için zorlamayınız. Doğal akademik tamlamaları (Örn: "kürt siyasal hareketi", "söylem dönüşümü", "sosyalist hareket", "siyasal ittifak") aynen kullanınız.
- AKADEMİK VARYASYON KURALI: Arama başarısını artırmak için kavramların eşanlamlılarını ve dilbilgisel varyasyonlarını da kullanınız (Örn: matriste "siyasi" geçiyorsa "siyasal" varyasyonunu da deneyin; "söylem dönüşümü" yerine "söyleminin dönüşümü" veya "söylemsel dönüşüm" kalıplarını üretin).
- KONU VE AKTÖR ODAKLILIK KURALI: Sadece kuram veya yöntem içeren sorgular kesinlikle üretmeyiniz (Örn: "çerçeveleme teorisi", "nitel söylem analizi" tek başına yasaktır). Kuram veya yöntem kullanılacaksa, bu kavramlar KESİNLİKLE ana aktörler veya konu odağı ile birleştirilerek çapraz sorgular oluşturulmalıdır.
- TEK SORUMLULUK KURALI: Bu yönerge yalnızca arama sorguları üretir. Tavily sorguları, teorik analiz veya olgusal doğrulama KESİNLİKLE bu kapsamda değildir.
- ÇIKTI FORMATI: Yanıtınız, yukarıda sağlanan litKeywordExtractionSchema ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Şemaya harfiyen uyunuz ve fazladan alan eklemeyiniz.
</constraints>

<examples>
  <example>
    <input>
{
  "mainActors": "Borçlandırılmış bireyler / işçi-borçlular. Araştırmanın temel öznesi, neoliberal dönemde bireysel borç ilişkisine dahil olan ve bu ilişki içinde belirli pratikler geliştiren borçlulardır.",
  "researchFocus": "Neoliberalizmde bireysel borçlandırmanın bir siyasal iktidar ilişkisi olarak nasıl işlediği.",
  "mainClaim": "Bireysel borçlandırma neoliberalizmde yalnızca ekonomik bir ilişki değil, siyasal bir iktidar ilişkisidir."
}
    </input>
    <output>
{
  "turkishQueries": [
    "türkiye bireysel borçlanma siyasal",
    "neoliberalizm borçlu özne pratik",
    "borçlanma iktidar ilişkisi türkiye"
  ],
  "englishQueries": [
    "neoliberalism debt subject turkey",
    "indebted worker political power",
    "debt governmentality daily practice"
  ]
}
    </output>
  </example>
</examples>

<task>
Disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı rolündesiniz. Göreviniz, girdi olarak sunulan kısıtlı tez matrisini (sadece aktör, odak ve iddia) analiz ederek; YÖKTEZ (Ulusal Tez Merkezi) veritabanında en alakalı benzer çalışmaları bulmak üzere 3-4 adet Türkçe ve 3-4 adet İngilizce konu/aktör odaklı akademik arama sorgusu üretmektir.
</task>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildLitKeywordPrompt(
  params: Pick<ThesisMatrix, "mainActors" | "researchFocus" | "mainClaim">,
): string {
  return `<context>
{
  "mainActors": "${params.mainActors.replace(/"/g, '\\"')}",
  "researchFocus": "${params.researchFocus.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}"
}
</context>

<task>
Sistem talimatında tanımlanan kurallara (özellikle Türkçe karakterleri koruma, akademik tamlama serbestliği, eşanlam varyasyonu ve konu/aktör odaklılık kurallarına) harfiyen bağlı kalarak, yukarıdaki <context> içindeki kısıtlı tez matrisi esasına göre en yüksek ilgililik oranını yakalayacak 3-4 adet Türkçe ve 3-4 adet İngilizce akademik arama sorgusu üretiniz.
- Tamamen sağlanan matris verilerine bağlı kalınız (Strictly Grounded).
- Çıktı formatının saf ham JSON (turkishQueries ve englishQueries anahtarları) olduğunu doğrulayınız.
Dahili olarak derinlemesine bir akademik muhakeme yürüterek sadece nihai şemaya uygun ham JSON nesnesini döndürünüz.
Cevaplamadan önce çok derin düşün.
</task>`;
}
