import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI
// ============================================================================

export const foundationalOracleResponseSchema: JsonSchema = {
  type: "object",
  properties: {
    selectedIndex: {
      type: "integer",
      description:
        "0-based index of the chosen work from the results array (0 for the first item, 1 for the second, etc.).",
    },
  },
  required: ["selectedIndex"],
};

// ============================================================================
// 2. SİSTEM TALİMATI
// ============================================================================

export function buildFoundationalOracleSystemInstruction(): string {
  return `# ROL
Sen, sana tanımlanan \`exa_academic_search\` aracını (tool) kullanarak dış dünyadaki gerçek akademik literatürü tarayan ve o listeden en uygun eserin dizin numarasını (index) seçen katı kurallı bir Editör ve Epistemologsun.

# OPERASYONEL KISITLAR (KAPALI SET VE SIFIR HALÜSİNASYON)
1. ARAÇ KULLANIMI: Sana verilen tez matrisini ve kutu metadata'sını inceleyerek, o alana en uygun akademik arama sorgusunu üret ve \`exa_academic_search\` fonksiyonunu tetikle.
2. KAPALI SET SEÇİM KURALI: Dışarıdan yazar adı, makale/kitap adı veya yıl uydurman kesinlikle yasaktır. Senin görevin sadece gelen listeden tezin ana iddiasını en iyi besleyen kök klasik eseri seçmek ve bu eserin listedeki 0 tabanlı dizin indeks numarasını (\`selectedIndex\`) döndürmektir.
3. Çıktıyı dışarıya hiçbir metin gürültüsü veya markdown bloğu sızdırmadan, doğrudan responseSchema kurallarına göre teslim et.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

export function buildFoundationalOracleUserPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
  box: {
    title: string;
    boxType: string;
    description: string;
    concepts?: string[];
    semanticQuery?: string | null;
  };
}): string {
  return `
[ANA TEZ MATRİSİ]
Başlık: ${params.studyTitle}
Araştırma Sorusu: ${params.researchQuestion}
Kuramsal Çerçeve: ${params.theoreticalFramework}
Metodoloji: ${params.methodology}
Araştırma Sınırları: ${params.researchScope}
Ana İddia (Main Claim): ${params.mainClaim}

[ANALİZ EDİLECEK ALT KUTU METADATASI]
Kutu Tipi: ${params.box.boxType}
Kutu Başlığı: ${params.box.title}
Açıklama: ${params.box.description}
Kavramlar: ${params.box.concepts ? params.box.concepts.join(", ") : ""}
Mevcut Semantik Kılavuz: ${params.box.semanticQuery || ""}

Adımlar:
1. Bu kutunun disipliner sınırlarına uygun bir arama parametresi belirle ve exa_academic_search aracını çağır.
2. Dönen ham listeden tezin ana iddiasını en iyi besleyen kök klasik eseri seç ve şemaya uygun döndür.`;
}
