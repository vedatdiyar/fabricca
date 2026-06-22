import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const literatureIrrelevanceFilterSchema: JsonSchema = {
  type: "object",
  properties: {
    excludedIds: {
      type: "array",
      description:
        "Alt kutu açıklaması ve tez bağlamıyla tamamen alakasız olan gürültü makalelerin benzersiz refId'leri. Sadece bariz şekilde farklı bir alana/konuya ait olanları ekle.",
      items: { type: "string" },
    },
  },
  required: ["excludedIds"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE) — ALAKASIZLIK FİLTRESİ
// ============================================================================
export function buildLiteratureAcademicReviewSystemInstruction(): string {
  return `# ROL
Sen akademik bir Alakasızlık Filtresisin (Noise Filter). Görevin son derece basittir: Sana sunulan makale özetlerini okuyup, o an işlenen alt kutunun (sub-box) tanımı ve tezin genel bağlamıyla **tamamen** ilgisiz olan gürültü makaleleri tespit etmektir.

# OPERASYONEL KISITLAMALAR
- Sadece **bariz şekilde alakasız** olanları ele. Bir makale alt kutuyla uzaktan bile ilişkiliyse veya emin değilsen, o makaleyi **eltme**, listede tut.
- Makaleleri metodolojik açıdan değerlendirme, kalite puanı verme veya önceliklendirme.
- Sadece şu durumlarda ele: Makale bambaşka bir akademik alana aitse (örneğin sosyoloji konulu bir kutuda siber güvenlik makalesi), başlık ve özet açıkça tez ve alt kutuyla hiçbir ortak nokta içermiyorsa.
- Aldığın her girdi makalesi zaten anlamsal arama motoru tarafından getirilmiştir; çoğu zaten ilgilidir. Sadece arama motorunun kaçırdığı bariz gürültüyü temizle.
- **Kritik:** output alanı sadece \`excludedIds\`'dir. Eleyecek makale bulamazsan boş dizi (\`[]\`) döndür. Asla uydurma ID türetme.

# ÇIKTI FORMATI
Yanıtın, sağlanan JSON şemasına %100 uyumlu, parse edilebilir bir ham JSON objesi olmalıdır. Markdown sarmalı, ön söz veya açıklama metni yasaktır.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildLiteratureAcademicReviewPrompt(
  box: { title: string; description: string },
  candidates: {
    refId: string;
    doi: string;
    title: string;
    abstract: string;
    url?: string;
    publisher?: string;
    publicationYear?: number;
    authors: string[];
    relevanceScore: number;
  }[],
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    researchScope: string;
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
  "researchScope": "${thesisCtx.researchScope.replace(/"/g, '\\"')}"
}
</kuresel_tez_matrisi>

<aday_makale_listesi>
${JSON.stringify(candidates)}
</aday_makale_listesi>

# TALİMATLAR VE GÖREV
<aday_makale_listesi> içindeki her makaleyi <hedef_alt_kutu> ve <kuresel_tez_matrisi> bağlamında değerlendir. Sadece alt kutu açıklaması ve tez konusuyla **hiçbir şekilde ilişkili olmayan** (farklı disiplin, bambaşka konu) bariz gürültü makalelerinin refId'lerini \`excludedIds\` dizisine ekle. Alakasız makale yoksa boş dizi döndür.`;
}
