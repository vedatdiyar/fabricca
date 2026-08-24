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
}

// ---------------------------------------------------------------------------
// 1. CITATION & PAGE AUDIT (RED PEN)
// ---------------------------------------------------------------------------

export const citationAuditJsonSchema: JsonSchema = {
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
};

export function buildCitationAuditPromptPayload(
  params: OfficeReviewPromptInput,
): PromptPayload {
  const {
    draftText,
    outlineTitle,
    outlineDescription,
    ragContext,
    notesContext,
  } = params;

  return buildPromptPayload({
    roleAndExpertise:
      'Sen saygın, son derece titiz ve tavizsiz bir Akademik Kaynak ve Sayfa Denetmenisin (Citation & Fact-Checking Auditor). "Danışmanın Çalışma Odası"nda öğrencinin teslim ettiği tez pasajındaki her bir atfı, yılı, sayfa aralığını ve olgusal iddiayı kütüphane bağlamıyla satır satır çapraz kontrol ediyorsun.',

    primaryTask:
      "Öğrencinin taslağında geçen tüm atıf, yazar, yıl, sayfa numarası ve iddiaları Kütüphane Kaynak Bağlamı ve Alıntı Fişleri ile karşılaştırarak katı bir Doğrulama ve Çelişki Denetim Raporu üretmektir.",

    rulesAndConstraints: `1. **Katı Kaynak & Sayfa Denetimi (Kırmızı Kalem):**
   - Taslakta geçen her yazar, yıl, sayfa aralığı (örn: "s. 45", "ss. 110-120") ve iddiayı kütüphane kaynakları ve notlarla tek tek karşılaştır.
   - Sayfa aralığındaki sayfalar geçerlidir (ss. 40-70 içinde s. 45 geçerlidir).
   - Metindeki iddia kaynakta yer almıyorsa, kaynakla çelişiyorsa veya atıf yapılan sayfanın sınırlarını aşıyorsa \`CRITICAL\` olarak işaretle (\`status: "MISMATCH"\` veya \`status: "UNVERIFIED"\`). \`message\` alanında bu iddianın kaynak metinde geçmediğini, sayfa dışı bir yargı veya temellendirilmemiş aşırı bir genelleme olduğunu açıkça belirt.
   - Kaynak doğru ve doğrulanmışsa \`NOTE\` veya \`WARNING\` ile \`status: "VERIFIED"\` olarak belirt.
2. **Akademik Dil:** Tüm açıklamalar yüksek düzey, net ve akademik Türkçe ile olmalıdır.`,

    workflowSteps: `1. Taslak metindeki tüm atıf ve iddiaları tespit et.
2. Bunları Kütüphane Kaynak Bağlamı ve Notlar ile satır satır denetle.
3. Her bulgu için doğrulama durumunu (VERIFIED/MISMATCH/UNVERIFIED) ve gerekçesini belirle.
4. JSON çıktısını eksiksiz üret.`,

    outputFormat: `- Yanıt kesinlikle belirtilen JSON şemasına uygun tek bir nesne olmalıdır.
- Markdown etiketleri dışında ek açıklama ekleme.`,

    inputContext: `### HEDEF TEZ BÖLÜMÜ:
Başlık: ${outlineTitle || "Genel Tez Bölümü"}
${outlineDescription ? `Açıklama: ${outlineDescription}` : ""}

### ÖĞRENCİNİN TASLAK METNİ:
${draftText}

${ragContext ? `### KÜTÜPHANE KAYNAK VE RAG BAĞLAMI:\n${ragContext}\n` : ""}
${notesContext ? `### KULLANICI NOTLARI VE ALINTI FİŞLERİ BAĞLAMI:\n${notesContext}\n` : ""}`,

    taskTrigger:
      "Öğrencinin taslağını kaynaklar ışığında satır satır denetle ve Citation Audit JSON nesnesini üret.",
  });
}

// ---------------------------------------------------------------------------
// 2. EDITORIAL POLISH DIFF (YELLOW PEN)
// ---------------------------------------------------------------------------

export const editorialPolishJsonSchema: JsonSchema = {
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
};

export function buildEditorialPolishPromptPayload(
  params: OfficeReviewPromptInput,
): PromptPayload {
  const { draftText, outlineTitle, outlineDescription } = params;

  return buildPromptPayload({
    roleAndExpertise:
      'Sen usta ve deneyimli bir Akademik Dil ve Metin Editörüsün (Academic Copyeditor & Stylist). "Zararsız Editoryal Rötuş" (Non-destructive Polish) ilkesiyle, lisansüstü tez metinlerini pürüzsüz, akıcı ve standartlara uygun hale getiriyorsun.',

    primaryTask:
      "Yazarın özgün üslubunu, argümanını, düşünce biçimini ve emeğini KESİNLİKLE BOZMADAN; sadece anlatım bozukluklarını, akademik geçiş pürüzlerini, yazım/noktalama hatalarını ve APA atıf biçimlerini hafifçe rötuşlayıp diff raporu sunmaktır.",

    rulesAndConstraints: `1. **Zararsız Editoryal Rötuş (Sarı Kalem - Non-destructive Polish):**
   - Yazarın özgün üslubunu, argümanını ve tez dilini KESİNLİKLE DEĞİŞTİRME / GASP ETME.
   - Taslağı baştan yazma; sadece anlatım bozukluklarını, akademik geçiş pürüzlerini, yazım hatalarını ve APA atıf formatlarını düzelt.
   - **Paragraf Yapısını Birebir Koru:** Orijinal taslaktaki paragraf ayrımlarını (\\n\\n), girintileri ve satır bloklarını KESİNLİKLE KORU. Farklı paragrafları asla tek bir metin bloğunda BİRLEŞTİRME.
   - Aşırı determinist veya ham ifadeleri akademik esneklik ve ihtiyatlılık diline çevir.
   - Yapılan iyileştirmeleri \`changes\` dizisinde kısa gerekçelerle belirt.
2. **Dil:** Yüksek düzey, pürüzsüz Türkçe.`,

    workflowSteps: `1. Taslak metni dikkatle oku.
2. Orijinal paragraf yapısını ve boşluklarını aynen koruyarak hafif bir editoryal rötuş yap.
3. Değişiklikleri maddeler halinde gerekçelendir.
4. JSON çıktısını üret.`,

    outputFormat: `- Yanıt kesinlikle belirtilen JSON şemasına uygun tek bir nesne olmalıdır.`,

    inputContext: `### HEDEF TEZ BÖLÜMÜ:
Başlık: ${outlineTitle || "Genel Tez Bölümü"}
${outlineDescription ? `Açıklama: ${outlineDescription}` : ""}

### ÖĞRENCİNİN ORİJİNAL TASLAK METNİ:
${draftText}`,

    taskTrigger:
      "Öğrencinin taslağına zararsız editoryal rötuş uygula ve Editorial Polish JSON nesnesini üret.",
  });
}

// ---------------------------------------------------------------------------
// 3. JURY CRITIQUES & SOCRATIC OBJECTIONS (BLUE PEN)
// ---------------------------------------------------------------------------

export const juryCritiquesJsonSchema: JsonSchema = {
  type: "object",
  properties: {
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
            description:
              "Öğrencinin savunmada hocaya sunabileceği çıkış/temellendirme argümanı.",
          },
        },
        required: [
          "id",
          "title",
          "critique",
          "category",
          "suggestedDefensePoint",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["juryCritiques"],
  additionalProperties: false,
};

export function buildJuryCritiquesPromptPayload(
  params: OfficeReviewPromptInput,
): PromptPayload {
  const { draftText, outlineTitle, outlineDescription } = params;

  return buildPromptPayload({
    roleAndExpertise:
      "Sen alanında uzman, derinlikli düşünen ve tez savunma jürisinde yer alan Kıdemli bir Tez Savunma Jüri Üyesi ve Profesörsün (Thesis Defense Jury & Socratic Challenger). Öğrencinin iddialarındaki epistemolojik gedikleri, mantık sıçramalarını ve temellendirilmemiş genellemeleri tespit ediyorsun.",

    primaryTask:
      "Tez savunmasında jüri üyelerinin sorabileceği en az 1, en fazla 3 kritik itiraz/şerh noktasını formüle etmek ve öğrencinin bu eleştirileri savunmada nasıl karşılayabileceğine dair çıkış noktaları (can simitleri) üretmektir.",

    rulesAndConstraints: `1. **Jüri Şerhleri ve Sokratik İtirazlar (Mavi Kalem):**
   - Tez savunmasında jüri üyelerinin sorabileceği en az 1, en fazla 3 kritik itiraz/şerh noktası belirle.
   - Kategoriler: \`LOGIC_LEAP\` (Mantık Sıçraması), \`UNBACKED_CLAIM\` (Temellendirilmemiş İddia), \`METHODOLOGICAL_GAP\` (Metodolojik Boşluk).
   - Her şerh için öğrencinin savunmada hocaya sunabileceği güçlü bir savunma argümanı (\`suggestedDefensePoint\`) öner.
   - **Teknik Kod Yasağı:** \`critique\`, \`title\` veya \`suggestedDefensePoint\` metinlerinin içerisine "(LOGIC_LEAP)", "(UNBACKED_CLAIM)", "(METHODOLOGICAL_GAP)" gibi teknik kodları veya İngilizce etiketleri ASLA YAZMA. Kategori yalnızca \`category\` JSON alanında tutulacaktır.
2. **Akademik Dil:** %100 duru, akıcı, yapıcı ve yüksek düzey akademik Türkçe ile ifade et.`,

    workflowSteps: `1. Taslak metindeki iddiaların kuramsal ve mantıksal tutarlılığını tart.
2. 1-3 adet jüri itiraz şerhi formüle et.
3. Her şerh için savunma argümanı geliştir.
4. JSON çıktısını üret.`,

    outputFormat: `- Yanıt kesinlikle belirtilen JSON şemasına uygun tek bir nesne olmalıdır.`,

    inputContext: `### HEDEF TEZ BÖLÜMÜ:
Başlık: ${outlineTitle || "Genel Tez Bölümü"}
${outlineDescription ? `Açıklama: ${outlineDescription}` : ""}

### ÖĞRENCİNİN TASLAK METNİ:
${draftText}`,

    taskTrigger:
      "Öğrencinin taslağı için jüri şerhlerini ve savunma önerilerini belirle ve Jury Critiques JSON nesnesini üret.",
  });
}
