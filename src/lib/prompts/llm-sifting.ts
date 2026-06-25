import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI
// ============================================================================
export const llmSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    selectedThesisIds: {
      type: "array",
      items: { type: "integer" },
      description:
        "Matrisle kavramsal, kuramsal veya metodolojik olarak örtüşen en alakalı tezlerin TEZARA ID'leri (En yüksek alakalılık derecesine göre sıralı, maksimum 15 adet).",
    },
  },
  required: ["selectedThesisIds"],
};

// ============================================================================
// 2. SİSTEM TALİMATI
// ============================================================================
export function buildLlmSiftingSystemInstruction(): string {
  return `# ROL
Sen kıdemli, geniş bir epistemolojik vizyona sahip evrensel bir akademik jüri üyesisin. Görevin, bir araştırmacının sağladığı tez matrisini (giriş verilerini) analiz etmek ve sunulan havuz içinden bu çalışmaya en ufak bir kuramsal, kavramsal, metodolojik veya bağlamsal katkı sunabilecek tezleri seçmektir.

# ÖNEMLİ PRENSİPLER
- **Yüzeydeki Kelime Eşleşmelerine Takılma:** Kavramların arkasındaki teorik akrabalıkları ve eş anlamlı derin bağları yakala (Örn: Özneleşme ↔ Subjectivity, Tahakküm ↔ Power/Dominance, Yönetimsellik ↔ Governmentality, Emek ↔ Labor).
- **Çapraz Dil Geçişi:** Dil bariyerini tamamen ortadan kaldır. Girdi verileri Türkçe olsa bile, İngilizce başlıkların altındaki akademik felsefeyi deşifre ederek çapraz eşleştirmeleri eksiksiz yap.
- **Bütüncül Değerlendirme:** Yalnızca tez başlıklarına ve künye bilgilerine (bölüm, yıl) erişimin olduğunu unutma. Kararını bu kısıtlı verideki semantik sinyalleri damıtarak ver.

# KISITLAMALAR
- Yalnızca <tez_listesi> içinde açıkça listelenen mevcut ID'lerden seçim yap. Asla listede olmayan bir ID'yi uydurma.
- Seçtiğin tezleri en alakalıdan başlayarak azalan bir alakalılık hiyerarşisiyle sırala.
- **Esnek Havuz Kuralı (Maksimum 15):** Havuzda matrisle doğrudan, dolaylı veya teğet geçen bir bağı olan **en fazla 15 tez** seçebilirsin. Eğer matrisle gerçekten ilişkilendirilebilecek nitelikli tez sayısı 15'ten az ise (örneğin sadece 7-8 güçlü tez varsa), listeyi zorla 15'e tamamlamak için tamamen alakasız/bağlantısız tezleri ekleme. Ancak, en ufak bir kuramsal veya metodolojik temas noktası barındıran tüm potansiyel tezleri listeye dahil etmeye özen göster.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================
export function buildLlmSiftingPrompt(
  params: {
    studyTitle: string;
    researchQuestion: string;
    mainClaim: string;
    theoreticalFramework: string;
    methodology: string;
    researchScope: string;
  },
  thesisList: {
    id: number;
    title: string;
    author: string;
    department: string;
    year: number;
  }[],
): string {
  const thesisLines = thesisList
    .map((t) => `${t.id} | ${t.title} | ${t.department} | ${t.year}`)
    .join("\n");

  return `<tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "researchScope": "${params.researchScope.replace(/"/g, '\\"')}"
}
</tez_matrisi>

<tez_listesi>
${thesisLines}
</tez_listesi>

Yukarıdaki <tez_matrisi> alanındaki kuramsal çerçeveyi, araştırma sorusunu, ampirik odağı, yöntemi ve temel iddiayı bütüncül olarak analiz et. 

Bu çalışmanın literatür taramasına, kuramsal tartışmasına veya metodolojik kurgusuna doğrudan ya da dolaylı olarak zemin oluşturabilecek, teğet geçse dahi ufuk açabilecek en nitelikli tezleri <tez_listesi> içinden cımbızla ayıkla. Seçtiğin tezlerin ID'lerini en alakalıdan başlayarak azalan bir korelasyon sırasıyla şemaya uygun bir JSON dizisi olarak döndür.`;
}
