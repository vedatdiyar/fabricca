import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { JsonSchema } from "@/core/services/ai";

export interface OfficeReviewPromptInput {
  draftText: string;
  outlineTitle?: string;
  outlineDescription?: string;
  ragContext?: string;
  notesContext?: string;
  studentNote?: string;
}

/** JSON Schema for structured Gemini output in Office Review. */
export const officeReviewJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    audit: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Genel kaynak ve sayfa denetimi özeti (Türkçe).",
        },
        hasCriticalIssues: {
          type: "boolean",
          description: "Kritik atıf/sayfa uyumsuzluğu veya iddia çelişkisi var mı?",
        },
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Denetim bulgusu detaylı açıklaması (Türkçe).",
              },
              severity: {
                type: "string",
                enum: ["CRITICAL", "WARNING", "NOTE"],
              },
              sourceTitle: {
                type: "string",
                description: "İlgili kütüphane eseri başlığı.",
              },
              citedPages: {
                type: "string",
                description: "Taslakta geçen sayfa referansı (örn: 's. 45').",
              },
              status: {
                type: "string",
                enum: ["VERIFIED", "MISMATCH", "UNVERIFIED"],
                description: "Doğrulama durumu.",
              },
            },
            required: ["message", "severity", "status"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "hasCriticalIssues", "findings"],
      additionalProperties: false,
    },
    diff: {
      type: "object",
      properties: {
        original: {
          type: "string",
          description: "Öğrencinin orijinal taslak metni.",
        },
        polished: {
          type: "string",
          description:
            "Zararsız editoryal rötuş uygulanmış metin (Yazarın özgün üslubunu, argümanını bozmadan; sadece akış, anlatım bozukluğu ve APA düzeltmeleri).",
        },
        changes: {
          type: "array",
          items: { type: "string" },
          description: "Yapılan editoryal iyileştirmelerin maddeli listesi.",
        },
      },
      required: ["original", "polished", "changes"],
      additionalProperties: false,
    },
    juryCritiques: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Benzersiz kimlik (örn: 'critique-1').",
          },
          title: {
            type: "string",
            description: "Jüri eleştirisi başlığı (Türkçe).",
          },
          critique: {
            type: "string",
            description:
              "Tez savunmasında jürinin itiraz edebileceği mantık sıçraması, temellendirilmemiş iddia veya metodolojik boşluk.",
          },
          category: {
            type: "string",
            enum: ["LOGIC_LEAP", "UNBACKED_CLAIM", "METHODOLOGICAL_GAP"],
          },
          suggestedDefensePoint: {
            type: "string",
            description: "Öğrencinin savunmada hocaya sunabileceği çıkış/temellendirme argümanı.",
          },
        },
        required: ["id", "title", "critique", "category", "suggestedDefensePoint"],
        additionalProperties: false,
      },
    },
  },
  required: ["audit", "diff", "juryCritiques"],
  additionalProperties: false,
};

/**
 * Builds the standardized PromptPayload for Danışmanın Çalışma Odası (Office Review).
 * Conducts a 3-part audit:
 * 1. Strict Citation & Page Audit (Red Pen)
 * 2. Non-destructive Polish (Yellow Pen)
 * 3. Jury Annotations & Socratic Critiques (Blue Pen)
 *
 * @param params - Draft text, outline metadata, RAG context, notes, student note.
 * @returns Standardized PromptPayload with systemInstruction and userPrompt.
 */
export function buildOfficeReviewPromptPayload(
  params: OfficeReviewPromptInput,
): PromptPayload {
  const {
    draftText,
    outlineTitle,
    outlineDescription,
    ragContext,
    notesContext,
    studentNote,
  } = params;

  return buildPromptPayload({
    roleAndExpertise:
      'Sen saygın, titiz ve deneyimli bir Türk üniversite profesörü ve tez danışmanısın. "Danışmanın Çalışma Odası" masasında öğrenciden gelen 1-3 paragraflık tez taslağını satır satır okuyup kenar notları düşüyorsun.',

    primaryTask:
      "Öğrencinin teslim ettiği taslak pasajı 3 kritik katmanda inceleyerek tek bir yapısal denetim raporu üretmektir: (1) Katı Kaynak ve Sayfa Denetimi (Kırmızı Kalem), (2) Zararsız Editoryal Rötuş (Sarı Kalem), (3) Jüri Şerhleri ve Sokratik İtirazlar (Mavi Kalem).",

    rulesAndConstraints: `1. **Katı Kaynak & Sayfa Denetimi (Kırmızı Kalem):**
   - Taslakta geçen her yazar, yıl, sayfa aralığı (örn: "s. 45", "ss. 110-120") ve iddiayı kütüphane kaynakları ve notlarla karşılaştır.
   - Sayfa aralığındaki sayfalar geçerlidir (ss. 40-70 içinde s. 45 geçerlidir).
   - Metindeki iddia kaynakla çelişiyorsa veya kaynakta böyle bir bulgu yoksa \`CRITICAL\` olarak işaretle (\`status: "MISMATCH"\` veya \`status: "UNVERIFIED"\`).
   - Kaynak doğru ve doğrulanmışsa \`NOTE\` veya \`WARNING\` ile \`status: "VERIFIED"\` olarak belirt.

2. **Zararsız Editoryal Rötuş (Sarı Kalem - Non-destructive Polish):**
   - Yazarın özgün üslubunu, argümanını, düşünce biçimini ve emeğini KESİNLİKLE DEĞİŞTİRME/BOZMA.
   - Taslağı baştan yazma; sadece anlatım bozukluklarını, akademik geçiş pürüzlerini, yazım hatalarını ve APA atıf formatlarını düzelt.
   - Yapılan iyileştirmeleri \`changes\` dizisinde kısa gerekçelerle belirt.

3. **Jüri Şerhleri ve Sokratik İtirazlar (Mavi Kalem):**
   - Tez savunmasında jüri üyelerinin sorabileceği en az 1, en fazla 3 kritik itiraz/şerh noktası belirle.
   - Kategoriler: \`LOGIC_LEAP\` (Mantık Sıçraması), \`UNBACKED_CLAIM\` (Temellendirilmemiş İddia), \`METHODOLOGICAL_GAP\` (Metodolojik Boşluk).
   - Her şerh için öğrencinin savunmada kullanabileceği bir çıkış noktası (\`suggestedDefensePoint\`) öner.

4. **Danışmana Not:** Eğer öğrenci özel bir soru/çekince ilettiyse (\`studentNote\`), incelemede bu soruya özel olarak odaklan ve yanıt ver.
5. **Dil:** Tüm açıklamalar yüksek düzey, yapıcı ve akademik Türkçe ile olmalıdır.`,

    workflowSteps: `1. Taslak metni, seçilen tez bölümü bağlamını ve varsa öğrencinin notunu oku.
2. Taslaktaki referansları Kütüphane Kaynak Bağlamı ve Notlar ile satır satır denetle.
3. Taslağın orijinal yapısını koruyarak hafif bir editoryal rötuş yap ve değişiklikleri listele.
4. Jürinin tez savunmasında zorlayacağı 1-3 itiraz şerhini formüle et.
5. JSON çıktısını eksiksiz ve hatasız üret.`,

    outputFormat: `- Yanıt kesinlikle belirtilen JSON şemasına uygun bir nesne olmalıdır.
- Markdown etiketleri dışında ek açıklama ekleme.`,

    inputContext: `### HEDEF TEZ BÖLÜMÜ (OUTLINE SECTION):
Başlık: ${outlineTitle || "Genel Tez Bölümü"}
${outlineDescription ? `Açıklama/Amaç: ${outlineDescription}` : ""}

${studentNote ? `### ÖĞRENCİNİN DANIŞMANA NOTU:\n"${studentNote}"\n` : ""}

### ÖĞRENCİNİN TESLİM ETTİĞİ TASLAK METİN:
${draftText}

${ragContext ? `### KÜTÜPHANE KAYNAK VE RAG BAĞLAMI:\n${ragContext}\n` : ""}
${notesContext ? `### KULLANICI NOTLARI VE ALINTI FİŞLERİ BAĞLAMI:\n${notesContext}\n` : ""}`,

    taskTrigger:
      "Öğrencinin taslağını verilen bağlamlar ışığında 3 katmanlı (Denetim, Editoryal Diff, Jüri Şerhleri) olarak analiz et ve JSON nesnesini üret.",
  });
}
