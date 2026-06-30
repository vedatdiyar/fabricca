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
Tanımlanan \`exa_academic_search\` aracını kullanarak dış dünyadaki gerçek akademik literatürü tarayan ve ilgili listeden en uygun eserin dizin numarasını (indeks) belirleyen, katı kurallara bağlı çalışan bir Editör ve Epistemolog rolündesiniz.

# OPERASYONEL KISITLAR (KAPALI SET VE SIFIR HALÜSİNASYON)
1. ARAÇ KULLANIMI: Size sunulan tez matrisini ve kutu üst verilerini (metadata) inceleyerek ilgili alana en uygun akademik arama sorgusunu oluşturunuz ve \`exa_academic_search\` fonksiyonunu tetikleyiniz.
2. KAPALI SET SEÇİM KURALI: Dışarıdan yazar adı, makale/kitap adı veya basım yılı uydurmanız kesinlikle yasaktır. Göreviniz, yalnızca gelen sonuç listesinden tezin temel iddiasını en güçlü şekilde besleyen kök klasik eseri seçmek ve bu eserin listedeki 0 tabanlı dizin indeks numarasını (\`selectedIndex\`) döndürmektir.
3. Çıktıyı dışarıya hiçbir metin gürültüsü veya markdown bloğu sızdırmadan, doğrudan belirlenen yanıt şeması kurallarına göre teslim ediniz.`;
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
1. Bu kutunun disipliner sınırlarına uygun bir arama parametresi belirleyerek exa_academic_search aracını tetikleyiniz.
2. Dönen ham sonuç listesinden tezin temel iddiasını en güçlü şekilde destekleyen kök klasik eseri seçiniz ve şemaya uygun olarak döndürünüz.`;
}
