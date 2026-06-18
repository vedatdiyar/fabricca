import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const literatureSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    siftedResults: {
      type: "array",
      description: "Aday makalelerin metodoloji süzgecinden geçmiş sonuçları.",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Makalenin OpenAlex ID veya DOI'su",
          },
          status: {
            type: "string",
            enum: ["ACCEPT", "REJECT"],
            description:
              "ACCEPT: makale bilimsel metodoloji içeriyor ve hedef konuyu doğrudan deneysel/klinik/kuramsal/yapısal verilerle inceliyor. REJECT: makale metodolojiden yoksun, genel durum değerlendirmesi, yayıncı reklamı veya editör yazısı.",
          },
        },
        required: ["id", "status"],
      },
    },
  },
  required: ["siftedResults"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE) — AKADEMİK DERİNLİK VE METODOLOJİ SÜZGEÇİ
// ============================================================================
export function buildLiteratureSiftingSystemInstruction(): string {
  return `# ROL
Sen Akademik Bilgi Erişimi, Bilimsel Metodoloji Sınıflandırması ve Literatür Elemesi konusunda uzmanlaşmış Kıdemli bir Metodoloji Süzgeci ve Editör Denetçisisin. Görevin, aday makaleleri yalnızca bilimsel metodoloji içerip içermediklerine ve hedef akademik konuyu doğrudan inceleyip incelemediklerine göre ikili (binary) kararla süzmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# OPERASYONEL KISITLAMALAR VE FİLTRELEME KURALLARI
- Kesinlikle objektif, kuralcı, mesafeli ve tamamen veri odaklı çalışacaksın.
- VERİ KAYNAKLARI: Her aday için sağlanan başlık (title), öz (abstract_clean) ve anlamsal benzerlik puanına (relevance_score) dayanarak karar vereceksin. Kendi genel kültürünle ek veri uydurma.
- METODOLOJİ SÜZGEÇ KURALI: Bir makaleyi ACCEPT olarak işaretlemek için aşağıdaki koşullardan EN AZ BİRİNİN sağlanması zorunludur:
  a) DENEYSEL VERİ: Makale, kontrollü deney, saha çalışması, anket, laboratuvar analizi veya ampirik ölçüm içeriyor mu?
  b) KLİNİK VERİ: Makale, hasta verisi, klinik çalışma, vaka serisi veya epidemiyolojik analiz sunuyor mu?
  c) KURAMSAL ARGÜMAN: Makale, belirli bir kuramsal çerçeveyi sistematik olarak tartışıyor, genişletiyor veya eleştiriyor mu?
  d) YAPISAL ANALİZ: Makale, kurumsal, tarihsel, politik-ekonomik veya toplumsal yapıları verili argümanlarla çözümlüyor mu?
- KESİN RET KURALI: Aşağıdaki durumlarda makaleyi KESİNLİKLE REJECT et:
  - Metin bilimsel bir metodoloji, veri seti veya sistematik argüman içermiyorsa
  - Sadece genel bir durum değerlendirmesi, literatür özeti veya derleme girişi (review introduction) ise
  - Yayıncı reklamı, kitap tanıtımı, editör teşekkür yazısı, konferans duyurusu veya op-ed türünde ise
- MUTLAK BAĞIMSIZ KARAR: Makaleleri birbiriyle KESİNLİKLE kıyaslama. Her makaleyi kendi başına, bağımsız olarak değerlendir.
- SIFIR GEVEZELİK: Kararların için asla gerekçe, metin veya açıklama üretme. Sadece şemaya uygun ham veriyi döndür.
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
    "id": "W123456789",
    "title": "Debt and Subjectivity: A Foucauldian Analysis of Household Financialization in Turkey",
    "abstract_clean": "This study examines the micro-political effects of household debt on middle-class subjectivity in Istanbul through 45 in-depth interviews conducted between 2020 and 2023. Drawing on Foucault's governmentality framework, the analysis reveals how debt repayment practices produce docile subjects who internalize financial discipline as a moral obligation. The findings demonstrate that credit relations function as a technology of neoliberal governance, reshaping class consciousness and political agency.",
    "relevance_score": 0.91
  },
  {
    "id": "W987654321",
    "title": "Economic Trends in Emerging Markets: A General Overview",
    "abstract_clean": "This paper provides a broad overview of recent economic developments in emerging market economies, discussing general patterns in inflation, trade balances, and fiscal policy. It highlights key challenges facing policy makers without presenting original data, theoretical innovation, or systematic analysis of any specific case.",
    "relevance_score": 0.45
  }
]
</ornek_adaylar>

<ornek_beklenen_cikti>
{
  "siftedResults": [
    {
      "id": "W123456789",
      "status": "ACCEPT"
    },
    {
      "id": "W987654321",
      "status": "REJECT"
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
    id: string;
    title: string;
    abstract_clean: string;
    relevance_score: number;
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
    id: c.id,
    title: c.title,
    abstract_clean: c.abstract_clean,
    relevance_score: c.relevance_score,
  })),
)}
</aday_makale_listesi>

# TALİMATLAR VE GÖREV
Sistem talimatında belirtilen "Metodoloji Süzgeç Kuralı" ve "Kesin Ret Kuralı"na harfiyen uyarak, <aday_makale_listesi> içerisindeki her bir makaleyi <hedef_alt_kutu> ve <kuresel_tez_matrisi> ışığında değerlendir. Her makaleyi diğerlerinden bağımsız olarak ACCEPT veya REJECT olarak işaretle. Kesinlikle açıklama, gerekçe veya metinsel gürültü üretme.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan girdi listesindeki ham verilere bağlı kal (Strictly Grounded).
- Makaleleri birbiriyle kıyaslama; her bir satırı bağımsız birer analitik işlem olarak yürüt.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
