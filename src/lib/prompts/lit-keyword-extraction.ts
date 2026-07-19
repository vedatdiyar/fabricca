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
        "YÖKTEZ veritabanında Türkçe dizinlenmiş tezleri bulmak için en uygun 4 adet Türkçe akademik arama sorgusu.",
    },
    englishQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖKTEZ veritabanında İngilizce dizinlenmiş tezleri bulmak için en uygun 4 adet İngilizce akademik arama sorgusu.",
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
- KATI 2 KELİME LİMİTİ: turkishQueries ve englishQueries listelerindeki HER BİR SORGU kesinlikle en az 2, en fazla 2 kelimeden oluşmalıdır. 3 veya daha fazla kelime içeren sorgular (Örn: "HADEP Marksist söylem") Meilisearch motorunda sıfır sonuç döndürdüğü için KESİNLİKLE YASAKTIR.
- KATI SAYI KISITI: turkishQueries listesi tam olarak 4 eleman içermelidir. englishQueries listesi tam olarak 4 eleman içermelidir. Toplamda 8 sorgu üretilecektir.
- ŞEMSİYE ARAMA KURALI: Matristen yola çıkarak en az 1 adet Türkçe ve 1 adet İngilizce geniş şemsiye sorgu üretilmelidir (Örn: "Kürt siyasal", "Kurdish political"). Şemsiye sorgular jenerik kalmamalı, matristeki temel aktör/odak kavramını yansıtmalıdır.
- ÇAPRAZ ARAMA KURALI: Aktör isimleri (HEP, DEP, HADEP, Özgürlük Dünyası vb.) tek başına kullanılmamalıdır. Her aktör kelimesi mutlaka yanına bağlamsal 1 kelime eklenerek çaprazlanmalıdır (Örn: "HADEP söylem", "DEP davası", "Kürt sol").
- TÜRKÇE KARAKTER KURALI: Türkçe sorgularda Türkçe karakterleri (ç, ğ, ı, ö, ş, ü, â) KESİNLİKLE aynen koruyunuz.
- AKADEMİK VARYASYON KURALI: Kavramların eşanlamlılarını ve dilbilgisel varyasyonlarını kullanınız (Örn: matriste "siyasi" geçiyorsa "siyasal" varyasyonunu da deneyin).
- YÖNTEMSEL GÜRÜLTÜ FİLTRESİ: Tek başına "söylem analizi", "metodoloji", "çerçeveleme", "kuram" gibi jenerik akademik kavramlar sorgularda yer alamaz. Bu kelimeler ancak bir aktör veya somut bağlamla çaprazlandığında kullanılabilir.
- TEK SORUMLULUK KURALI: Bu yönerge yalnızca arama sorguları üretir.
- ÇIKTI FORMATI: Yanıtınız, sağlanan litKeywordExtractionSchema ile %100 uyumlu, parse edilebilir bir ham JSON objesi olmalıdır.
</constraints>

<examples>
  <example>
    <input>
{
  "researchCore": "Borçlandırılmış bireyler / işçi-borçlular, Neoliberal devlet politikaları — Neoliberalizmde bireysel borçlandırmanın bir siyasal iktidar ilişkisi olarak işleyişi",
  "mainClaim": "Bireysel borçlandırma neoliberalizmde yalnızca ekonomik bir ilişki değil siyasal bir iktidar ilişkisidir"
}
    </input>
    <output>
{
  "turkishQueries": [
    "borçlu özne",
    "neoliberal borç",
    "işçi borçlanma",
    "borç iktidar"
  ],
  "englishQueries": [
    "debt subject",
    "neoliberal indebted",
    "worker debt",
    "debt power"
  ]
}
    </output>
  </example>
</examples>

<task>
Disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı rolündesiniz. Göreviniz, girdi olarak sunulan kısıtlı tez matrisini (aktör, odak ve iddia) analiz ederek; YÖKTEZ (Ulusal Tez Merkezi) Meilisearch indeksinde en alakalı benzer çalışmaları bulmak üzere 4 adet Türkçe ve 4 adet İngilizce (toplam 8 adet) 2 kelimelik akademik arama sorgusu üretmektir. Her sorgu kesinlikle 2 kelime olmalı, şemsiye ve çapraz formatlarda olmalıdır.
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
1. HER SORGU KESİNLİKLE 2 KELİMEDEN OLUŞMALIDIR. 3 kelime yasaktır.
2. En az 1 Türkçe ve 1 İngilizce şemsiye sorgu üretiniz.
3. Aktör adlarını tek başına kullanmayınız, mutlaka bağlamla çaprazlayınız.
4. Jenerik yöntem/kuram kelimelerini sorgularda kullanmayınız.
Tam olarak 4 Türkçe ve 4 İngilizce (toplam 8) sorgu üretiniz.
Cevaplamadan önce çok derin düşün.
</task>`;
}
