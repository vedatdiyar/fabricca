import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const literatureSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    siftedResults: {
      type: "array",
      description: "Aday makalelerin hızlı süzme sonuçlarının listesi.",
      items: {
        type: "object",
        properties: {
          doi: { type: "string", description: "Makalenin DOI numarası" },
          title: { type: "string", description: "Makalenin orijinal başlığı" },
          keep: {
            type: "boolean",
            description:
              "Makale barajı geçip havuzda tutulmalı mı? (Puan >= 75 ise true, değilse false)",
          },
          score: {
            type: "integer",
            description:
              "Makalenin tez matrisine ve alt kutuya olan bağımsız uygunluk puanı (1-100 arası).",
          },
        },
        required: ["doi", "title", "keep", "score"],
      },
    },
  },
  required: ["siftedResults"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildLiteratureSiftingSystemInstruction(): string {
  return `# ROL
Sen akademik bilgi erişimi, hızlı literatür taraması ve konu taksonomisi sınıflandırması konusunda uzman, ultra kararlı çalışan Kıdemli bir Filtreleme Motorusun. Görevin, geniş bir makale havuzundan yalnızca belirli bir akademik alt konu kutusuyla ve tezin küresel matrisiyle anlamsal olarak bağlantılı olanları ikili (binary) kararla süzmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE FİLTRELEME KURALLARI
- Kesinlikle objektif, metodolojik, mesafeli ve tamamen veri odaklı bir akademik Türkçe kullanacaksın.
- VERİ SINIRLILIĞI UYARISI: Aday makalelerin özet (abstract) metinleri sağlanmamıştır; kararını YALNIZCA başlık, metadata etiketleri ve yazar bilgisine dayanarak vermek zorundasın. Kendi genel kültürünle özet uydurma.
- ÜÇ BOYUTLU KATMA DEĞER FİLTRESİ: Her aday makaleyi şu üç boyuttan en az birinde tez matrisine katma değer sunması açısından test et:
  a) BAĞLAMSAL BOYUT: Amiral odağı tezin tarihsel/mekansal sınırlılıklarıyla örtüşüyor mu?
  b) KURAMSAL BOYUT: Tezin kuramsal çerçevesiyle (teoriler, kavramlar) anlamsal kesişim gösteriyor mu?
  c) YÖNTEMSEL BOYUT: Tezin metodolojik tasarımına ışık tutacak bir model sunuyor mu?
  *Eğer bir makale bu üç boyuttan en az birinde somut katma değer sunuyorsa "keep: true" koridoruna girebilir. Hiçbir boyutta katkısı olmayan makaleler acımasızca elenir.*
- MUTLAK BAĞIMSIZ PUANLAMA: Makaleleri birbiriyle KESİNLİKLE kıyaslama. Her makale, tez matrisine ve alt kutu kriterlerine göre kendi başına, bağımsız olarak 1-100 arasında mutlak bir puan alır. score >= 75 ise keep: true; score < 75 ise keep: false olmak zorundadır.
- SIFIR GEVEZELİK VE MUTLAK SESSİZLİK: Kararların, puanların veya eşleştirmelerin için asla ama asla bir gerekçe, metin veya açıklama üretme. Sadece şemaya uygun ham veriyi döndür.
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`literatureSiftingSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_alt_kutu>
{
  "title": "Neoliberal Yönetimsellik ve Borç Ekonomisi",
  "description": "Borçlandırmanın bireyler üzerindeki mikro-iktidar ve özneleşme süreçlerinin incelenmesi."
}
</ornek_alt_kutu>

<ornek_kuresel_matris>
{
  "studyTitle": "Borçlu Öznelliğin Üretimi",
  "researchQuestion": "Kişisel borçlar beyaz yakalıların günlük özneleşme süreçlerini nasıl şekillendiriyor?",
  "theoreticalFramework": "Foucaultcu yönetimsellik ve Marksist emek süreci teorisi.",
  "historicalSpatialLimits": "2018-2025 arası Türkiye, İstanbul."
}
</ornek_kuresel_matris>

<ornek_adaylar>
[
  {
    "doi": "10.1080/neolib.112",
    "title": "The Subject of Debt: Governmentality in Financial Capitalism",
    "metadata": "Topics: Governmentality, Subjectification, Foucault, Capitalism",
    "authors": ["John Doe"]
  },
  {
    "doi": "10.1016/j.fish.2019",
    "title": "Marine Ecosystem Regulation Parameters in the North Sea",
    "metadata": "Topics: Marine Biology, Regulation, Ecology",
    "authors": ["Robert Hill"]
  }
]
</ornek_adaylar>

<ornek_beklenen_cikti>
{
  "siftedResults": [
    {
      "doi": "10.1080/neolib.112",
      "title": "The Subject of Debt: Governmentality in Financial Capitalism",
      "keep": true,
      "score": 95
    },
    {
      "doi": "10.1016/j.fish.2019",
      "title": "Marine Ecosystem Regulation Parameters in the North Sea",
      "keep": false,
      "score": 12
    }
  ]
}
</ornek_beklenen_cikti>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildLiteratureSiftingPrompt(
  box: { title: string; description: string },
  candidates: {
    doi: string;
    title: string;
    metadata: string;
    authors: string[];
  }[],
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    historicalSpatialLimits: string;
  },
): string {
  return `<hedef_alt_kutu>
{
  "title": "${box.title.replace(/"/g, '\\"')}",
  "description": "${box.description.replace(/"/g, '\\"')}"
}
</hedef_alt_kutu>

<kuresel_tez_matrisi>
{
  "studyTitle": "${thesisCtx.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${thesisCtx.researchQuestion.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${thesisCtx.theoreticalFramework.replace(/"/g, '\\"')}",
  "historicalSpatialLimits": "${thesisCtx.historicalSpatialLimits.replace(/"/g, '\\"')}"
}
</kuresel_tez_matrisi>

<aday_makale_listesi>
${JSON.stringify(
  candidates.map((c) => ({
    doi: c.doi,
    title: c.title,
    metadata: c.metadata,
    authors: c.authors,
  })),
)}
</aday_makale_listesi>

# TALİMATLAR VE GÖREV
Sistem talimatında belirtilen "Üç Boyutlu Katma Değer Filtresi" ve "Mutlak Bağımsız Puanlama" kurallarına harfiyen uyarak, <aday_makale_listesi> içerisindeki her bir makaleyi <hedef_alt_kutu> ve <kuresel_tez_matrisi> ışığında değerlendir. Her makaleyi diğerlerinden bağımsız olarak 1-100 arası puanla, puanı 75 ve üzeri olanları \`keep: true\` olarak işaretle. Kesinlikle açıklama, gerekçe veya metinsel gürültü üretme.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan girdi listesindeki ham verilere bağlı kal (Strictly Grounded). 
- Makaleleri birbiriyle kıyaslama; her bir satırı bağımsız birer analitik işlem olarak yürüt.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
