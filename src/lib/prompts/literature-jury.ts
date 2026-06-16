import type { JsonSchema } from "../gemini";

export const literatureJuryAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    starterPack: {
      type: "array",
      description:
        "En kritik makaleler — doğrudan tez silsilesine temel oluşturacak ana kaynaklar (en fazla 5).",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["PRIMARY", "SECONDARY"],
            description:
              "PRIMARY: Teoriyi kuran kurucu metin veya doğrudan ampirik katkı. SECONDARY: İkincil uygulama veya arka plan katkısı.",
          },
          title: { type: "string" },
          abstract: { type: "string" },
          url: { type: "string" },
          doi: { type: "string" },
          publisher: { type: "string" },
          publicationYear: { type: "integer" },
          authors: {
            type: "array",
            items: { type: "string" },
          },
          strategicRecommendations: {
            type: "string",
            description:
              "Bu makalenin bu kutunun tez silsilesine neden ve nasıl kurucu bir katkı sunacağını açıklayan akademik gerekçe.",
          },
        },
        required: [
          "type",
          "title",
          "doi",
          "authors",
          "strategicRecommendations",
        ],
      },
    },
    reservedPool: {
      type: "array",
      description:
        "Potansiyel katkı sağlayabilecek yedek havuz — mevcut gerçek adaylarla doldurulur (en fazla 15).",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["PRIMARY", "SECONDARY"],
          },
          title: { type: "string" },
          abstract: { type: "string" },
          url: { type: "string" },
          doi: { type: "string" },
          publisher: { type: "string" },
          publicationYear: { type: "integer" },
          authors: {
            type: "array",
            items: { type: "string" },
          },
          strategicRecommendations: { type: "string" },
        },
        required: [
          "type",
          "title",
          "doi",
          "authors",
          "strategicRecommendations",
        ],
      },
    },
  },
  required: ["starterPack", "reservedPool"],
};

export const LITERATURE_JURY_ANALYSIS_SYSTEM_INSTRUCTION = `
<role>
Sen akademik literatür değerlendirmesi, kaynak hiyerarşisi ve araştırma sentezi konularında uzman, tavizsiz bir profesör ve kıdemli jüri üyesisin. Görevin, belirli bir alt konu kutusu (sub-box) için süzgeçten geçmiş makale adaylarını semantik ve epistemolojik olarak puanlamak, en kritik makaleleri (en fazla 5) "Starter Pack" ve kalan potansiyellileri (en fazla 15) "Reserved Pool" olarak seçmektir.
</role>

<instructions>
Cevap üretmeden önce içsel olarak şu 2 adımlı analitik planı işlet:
1. **Sınıflandırma ve Sıralama**: Makaleleri akademik önem, alaka düzeyi ve tez matrisine katkı potansiyeline göre hiyerarşik olarak sırala.
2. **Kota Yönetimi**: En yüksek ağırlıklı makaleleri "starterPack" (en fazla 5) ve "reservedPool" (en fazla 15) dizilerine yerleştir.
</instructions>

<constraints>
- STRATEJİK GEREKÇE ZORUNLULUĞU: Her makale için "strategicRecommendations" alanına şu sorunun net cevabını yaz: "Bu makale bu kutunun ve tezin kuramsal/metodolojik omurgasına neden ve nasıl bir referans zemin sunuyor?"

- ESNEK KOTA KURALI (Flexible Quota): "starterPack" EN FAZLA 5, "reservedPool" EN FAZLA 15 makale içerebilir. Sifting aşamasından gelen doğrulanmış gerçek aday sayısı bu üst sınırları doldurmaya yetmiyorsa, listeleri sahte verilerle (uydurma başlık, yazar, yayın yılı) KESİNLİKLE ŞİŞİRME. Yalnızca elindeki mevcut gerçek makaleleri önem, kuramsal kuruculuk ve hiyerarşi sırasına göre havuzlara dağıt; kalan kontenjanları boş bırak. Hiç aday yoksa starterPack ve reservedPool tamamen boş ([]) dönebilir; bu, halüsinasyon üretmekten katbekat iyidir.

- DİL: "strategicRecommendations" alanlarını ve tüm metin içeriklerini tamamen akıcı, hatasız, elit bir akademik Türkçe ile yaz.

- AKADEMİK BARAJ PUANI VE TUTARLILIK (Academic Threshold Mandate): Adayların siftingScore değerlerini katı bir filtre olarak kullan. SiftingScore değeri 85 ve üzerinde olan kurucu makaleleri önem sırasına göre 'starterPack' listesine yerleştir. SiftingScore değeri 75 ile 84 arasında olan ya da starterPack kotasına sığmayan diğer kaliteli kaynakları 'reservedPool' listesine al. SiftingScore değeri 75'in altında olan veya kutunun öz omurgasına doğrudan katkı sunmayan tüm zayıf/çeper makaleleri — kotaları doldurmak adına bile olsa — KESİNLİKLE LİSTELERE DAHİL ETME, acımasızca dışarıda bırak.
</constraints>

<output_format>
Yalnızca literatureJuryAnalysisSchema yapısına tam uyumlu, geçerli ve temiz bir JSON nesnesi döndür.
</output_format>
`;

export function buildLiteratureJuryAnalysisPrompt(
  box: {
    title: string;
    description: string;
  },
  siftedCandidates: {
    doi: string;
    title: string;
    abstract: string;
    url?: string;
    publisher?: string;
    publicationYear?: number;
    authors: string[];
    siftingScore?: number;
  }[],
): string {
  return `
<context>
Alt Konu Kutusu (Sub-box) Detayları:
- Başlık: ${box.title}
- Açıklama: ${box.description}

Süreçten Geçmiş (Keep: True) Makale Adayları:
${JSON.stringify(siftedCandidates)}
</context>

<task>
Sistem talimatındaki "Stratejik Gerekçe Zorunluluğu", "Esnek Kota Kuralı" ve "Akademik Baraj Puanı" standartlarına harfiyen uyarak, yukarıdaki makale adaylarını semantik olarak puanla. En kritik ve kurucu makaleleri "starterPack" listesine, potansiyel katkı sağlayacak diğer makaleleri "reservedPool" listesine yerleştir. Her makale için akademik gerekçe sun.
</task>

<final_instruction>
Yukarıda sağlanan alt kutu bağlamını ve elenmiş aday listesini temel alarak, dahili hiyerarşik puanlama planını uygula ve şimdi JSON yanıtını oluştur.
</final_instruction>
`;
}
