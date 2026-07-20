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
        "YÖKTEZ veritabanında Türkçe dizinlenmiş tezleri bulmak için en uygun 8 adet Türkçe akademik arama sorgusu.",
    },
    englishQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖKTEZ veritabanında İngilizce dizinlenmiş tezleri bulmak için en uygun 8 adet İngilizce akademik arama sorgusu.",
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
- Bilgi kesim tarihiniz Ocak 2025'tir. Şu anki yıl 2026'dır.
- KELİME LİMİTİ: Arama sorguları en az 2, en fazla 3 kelimeden oluşmalıdır. Sadece metinde doğrudan geçen çok spesifik özel isimler, kısaltmalar veya yayın adları (Örn: 'AktörX', 'DergiY') için istisnai olarak 1 kelimelik sorguya izin verilir.
- SAYI KISITI: turkishQueries listesi tam olarak 8 eleman içermelidir. englishQueries listesi tam olarak 8 eleman içermelidir. Toplamda 16 sorgu üretilecektir.
- ŞEMSİYE ARAMA KURALI: Matristen yola çıkarak en az 1 adet geniş şemsiye sorgu üretilmelidir (Örn: 'DisiplinA politikalari', 'DisiplinA dynamics'). Şemsiye sorgular jenerik kalmamalı, matristeki temel odak kavramını yansıtmalıdır.
- ÇAPRAZ ARAMA KURALI: Aktör veya yayın isimleri tek başına kullanılmamalıdır (1 kelimelik istisnalar hariç). Her aktör kelimesi mutlaka yanına bağlamsal 1 kelime eklenerek çaprazlanmalıdır (Örn: 'AktörX söylemi', 'DergiY analizi').
- TÜRKÇE KARAKTER KURALI: Türkçe sorgularda Türkçe karakterleri (ç, ğ, ı, ö, ş, ü, â) KESİNLİKLE aynen koruyunuz.
- AKADEMİK VARYASYON KURALI: Kavramların eşanlamlılarını ve dilbilgisel varyasyonlarını kullanınız (Örn: matriste 'siyasi' geçiyorsa 'siyasal' varyasyonunu da deneyin).
- YÖNTEMSEL GÜRÜLTÜ FİLTRESİ: Tek başına 'söylem analizi', 'metodoloji', 'kuram' gibi jenerik akademik kavramlar sorgularda yer alamaz. Bu kelimeler ancak bir aktör veya somut bağlamla çaprazlandığında kullanılabilir.
- TEK SORUMLULUK KURALI: Bu yönerge yalnızca arama sorguları üretir.
- ÇIKTI FORMATI: Yanıtınız, sağlanan litKeywordExtractionSchema ile %100 uyumlu, parse edilebilir bir ham JSON objesi olmalıdır.
</constraints>

<examples>
  <example>
    <input>
{
  "researchCore": "Neoliberalizmde bireysel borçlandırmanın ve işçi sınıfı borçlanmasının bir iktidar ilişkisi olarak işleyişi",
  "mainClaim": "Bireysel borçlandırma yalnızca ekonomik bir ilişki değil, Foucaultcu ve Marksist yaklaşımlar çerçevesinde işçi-borçluların tabi kılındığı asimetrik bir iktidar ilişkisidir."
}
    </input>
    <output>
{
  "turkishQueries": [
    "borçlu öznellik",
    "neoliberal borçlanma",
    "işçi sınıfı borç",
    "borç iktidar ilişkisi",
    "finansal disiplin",
    "borç tabi kılınma",
    "neoliberal borçluluk",
    "borç asimetrisi"
  ],
  "englishQueries": [
    "indebted subjectivity",
    "neoliberal indebtedness",
    "working class debt",
    "debt power relations",
    "financial discipline",
    "debt subordination",
    "neoliberal debt politics",
    "debt asymmetry"
  ]
}
    </output>
  </example>
</examples>

<task>
Disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı rolündesiniz. Göreviniz, girdi olarak sunulan kısıtlı tez matrisini (aktör, odak ve iddia) analiz ederek; Meilisearch indeksinde en alakalı benzer çalışmaları bulmak üzere 8 adet Türkçe ve 8 adet İngilizce (toplam 16 adet) akademik arama sorgusu üretmektir.
</task>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildLitKeywordPrompt(
  params: Pick<ThesisMatrix, "researchCore" | "mainClaim">,
): string {
  return `<context>
{
  "researchCore": "${params.researchCore.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}"
}
</context>

<task>
Sistem talimatındaki kurallara harfiyen uyarak:
1. HER SORGU 2 VEYA 3 KELİMEDEN OLUŞMALIDIR (Spesifik özel isim/kısaltmalar hariç).
2. En az 1 Türkçe ve 1 İngilizce şemsiye sorgu üretiniz.
3. Aktör adlarını tek başına kullanmayınız, mutlaka bağlamla çaprazlayınız.
4. Jenerik yöntem/kuram kelimelerini sorgularda tek başına kullanmayınız.
Tam olarak 8 Türkçe ve 8 İngilizce (toplam 16) sorgu üretiniz.
Cevaplamadan önce çok derin düşün.
</task>`;
}
