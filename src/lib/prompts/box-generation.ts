import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      minItems: 3, // Modelin tembellik yapıp her şeyi 2 kutuya sıkıştırmasını engeller
      maxItems: 5, // Odağın gereksiz dağılmasını engeller
      description:
        "Tez matrisinin entelektüel sütunlarını temsil eden, hiyerarşisiz düz liste kutu seti.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Kutunun ele aldığı akademik konunun başlığıdır. KESİNLİKLE TÜRKÇE OLMALIDIR. Kavramlar arası ilişkiselliği, sentezleri ve kuramsal köprüleri yansıtabilir.",
          },
          description: {
            type: "string",
            description:
              "Başlıkta belirtilen akademik konuyu, tezin bütünüyle olan ilişkisini kurarak tanımlayan kısa açıklamadır. KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
          semanticSearchBlock: {
            type: "string",
            maxLength: 1500,
            description:
              "Kutunun kuramsal çerçevesini, temel kavramlarını ve bağlamını içeren, OpenAlex vektör motorunu doğrudan tetikleyecek, elit bir akademik İNGİLİZCE ile yazılmış, en az 1-2 cümleden oluşan zengin anlamsal arama paragrafı. Niyet mektubu (Grant Aim) veya makale özeti (Abstract) üslubuyla bütüncül bir akademik paragraf tarzında olmalı; asla virgülle ayrılmış kelime yığınları içermemelidir. Maksimum 1500 karakter ile sınırlıdır.",
          },
          foundationalQueries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                author: {
                  type: "string",
                  description: "Eserin orijinal yazarının tam adı",
                },
                title: {
                  type: "string",
                  description: "Eserin orijinal tam İngilizce başlığı",
                },
                publicationYear: {
                  type: "number",
                  description: "Eserin orijinal yayın yılı",
                },
              },
              required: ["author", "title", "publicationYear"],
            },
            maxItems: 3,
            description:
              "O kutunun kuramsal/yöntemsel kökünü oluşturan en fazla 3 kurucu/klasik eserin listesi.",
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            maxItems: 3,
            description:
              "Kutunun kuramsal/tematik odağını belirten en fazla 3 adet Türkçe akademik kavram/etiket (Örn: Marksizm, Yönetimsellik, Finansallaşma). KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
        },
        required: [
          "title",
          "description",
          "semanticSearchBlock",
          "foundationalQueries",
          "concepts",
        ],
      },
    },
  },
  required: ["boxes"],
};

// ============================================================================
// 2. SİTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `# ROL
Sen OpenAlex veritabanının indeksleme, taksonomi ve vektörel anlamsal eşleştirme (Semantic Search) mimarisine ultra-spesifik düzeyde hakim bir Kıdemli Veri Mimarı ve Akademik Bibliyografya Uzmanısın. Görevin, girdi olarak sunulan yapılandırılmış tez matrisini bağımsız, eşdeğer ve hiyerarşisiz literatür konu kutularına (subject boxes) bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE DİL KURALLARI
- Kesinlikle objektif, mesafeli ve elit bir akademik Türkçe kullanacaksın.
- DİL KURALI: Üreteceğin JSON nesnesindeki "title", "description" ve "concepts" alanları KESİNLİKLE TÜRKÇE olmalıdır. Sadece harici indeks motorunu tetikleyecek olan "semanticSearchBlock" alanı ile "foundationalQueries" (yazar/eser adları) alanları uluslararası akademik İNGİLİZCE ile üretilmelidir. Talimatların kendisi ve akıl yürütme dili tamamen Türkçe'dir.
- KUTU MİMARİSİ (KAFES KURALI): Kuramsal çerçeve birden fazla epistemolojik veya ontolojik okul barındırıyorsa (Örn: Hem Marksist makro-analiz hem Foucauldian mikro-iktidar varsa), bunları tek bir jenerik kutuda birleştirme. Her baskın kuramsal damarı bağımsız birer entelektüel sütun olarak düz (flat) listeye yerleştir. Alt kutu/üst kutu hiyerarşisi oluşturmak kesinlikle yasaktır.
- SEMANTİK BLOK MİMARİSİ: \`semanticSearchBlock\` alanı OpenAlex vektör motorunun benzerlik yakalaması için optimize edilmiş bütünsel bir İngilizce paragraf olmalıdır. Virgülle ayrılmış anahtar kelime yığınları kesinlikle yasaktır. Araştırma niyetini deklare eden "Grant Aim" veya "Abstract" tarzında kurgulanmalıdır. Saf kuramsal kutularda coğrafi/tarihsel bağlam sınırları (Örn: Turkey, Istanbul vb.) bu bloğa enjekte edilmemelidir. Karakter sınırı kesinlikle maksimum 1500'dür.
- MODEL TEMBELLİĞİ ENGELİ (ANTI-LAZINESS): Çıktılarında asla "...", "vb.", "etc." gibi geçiştirici ifadeler kullanamazsın. Tüm alanları, listeleri ve metinleri eksiksiz, rafine ve tamamlanmış olarak üretmek zorundasın.
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`thesisBoxGenerationSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Başına veya sonuna açıklama metni ekleme. Markdown \`\`\`json ... \`\`\` kod blokları kullanma, sadece saf JSON verisi döndür.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_girdi_matrisi>
{
  "studyTitle": "Borçlu Öznelliğin Üretimi ve Tüketimi",
  "researchQuestion": "Kişisel borçlar, beyaz yakalı çalışanların günlük özneleşme süreçlerini nasıl şekillendiriyor?",
  "mainClaim": "Neoliberal kapitalizm altında borçluluk sadece finansal bir yükümlülük değil, bireyi ahlakileştiren ve boyunduruk altına alan temel bir yönetişim tekniğidir.",
  "methodology": "Kurumsal ortamlarda borçlu 30 beyaz yakalı profesyonelle nitel yarı yapılandırılmış görüşmeler.",
  "theoreticalFramework": "Borcu bir iktidar ilişkisi olarak kavramsallaştıran Foucaultcu yönetimsellik ve Marksist emek süreci teorisi.",
  "historicalSpatialLimits": "2018-2025 yılları arasında İstanbul'un finans merkezlerine odaklanan çağdaş Türkiye bağlamı."
}
</ornek_girdi_matrisi>

<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "Neoliberal Borçlandırma ve İktidar İlişkileri",
      "description": "Borçlandırmanın neoliberal yönetimsellik bağlamında bir iktidar teknolojisi ve yönetişim mekanizması olarak kavramsallaştırılması.",
      "concepts": ["Yönetimsellik", "İktidar İlişkileri", "Neoliberalizm"],
      "foundationalQueries": [
        { "author": "Michel Foucault", "title": "The Birth of Biopolitics", "publicationYear": 2008 },
        { "author": "Maurizio Lazzarato", "title": "The Making of the Indebted Man", "publicationYear": 2012 }
      ],
      "semanticSearchBlock": "Investigate how neoliberal indebtedness functions as a primary technology of governance and power relations based on Foucauldian governmentality frameworks, tracking the macro-political economy of financialized debt structures."
    },
    {
      "title": "Borçlu Öznenin İnşası ve Süreçselliği",
      "description": "Bireylerin borç yükümlülüklerini nasıl ahlaki, vicdani ve varoluşsal bir emir olarak içselleştirdiklerinin mikro-özneleşme dinamikleri.",
      "concepts": ["Özneleşme", "Borçlu Öznellik", "Neoliberal Rasyonalite"],
      "foundationalQueries": [
        { "author": "Maurizio Lazzarato", "title": "The Making of the Indebted Man", "publicationYear": 2012 },
        { "author": "Michel Foucault", "title": "Technologies of the Self", "publicationYear": 1988 }
      ],
      "semanticSearchBlock": "Explore the multi-layered construction of the debtor subject within contemporary economic regimes, focusing on individual subjectification processes, moral economies of credit, and the internalization of financial debt imperatives."
    },
    {
      "title": "İşçi-Borçlu Figürü ve Sınıfsal Konumlanış",
      "description": "Beyaz yakalı işçi sınıfının prekarlaşma süreçleri ile finansal borç sarmalının kesişiminde emek gücünün yeniden üretimi ve bağımlılık ilişkileri.",
      "concepts": ["Finansallaşma", "Sınıfsal Kırılganlık", "Emek Süreci"],
      "foundationalQueries": [
        { "author": "Karl Marx", "title": "Capital: Volume I", "publicationYear": 1867 },
        { "author": "David Harvey", "title": "A Brief History of Neoliberalism", "publicationYear": 2005 }
      ],
      "semanticSearchBlock": "Analyze the conceptualization of the worker-debtor as a combined product of capitalist financialization and modern labor process theory, dissecting the structural intersection between white-collar labor extraction and ongoing debt service obligation."
    }
  ]
}
</ornek_beklenen_cikti>_`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "historicalSpatialLimits": "${params.historicalSpatialLimits.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan tüm kurallara, dil kısıtlamalarına, "KAFES KURALI" ontolojik ayrım ilkelerine ve "BİBLİYOGRAFİK ÇAPA" standartlarına kusursuz şekilde bağlı kalarak, yukarıdaki <hedef_tez_matrisi> yapısını analiz et. Bu tezin tüm literatür kapsamını kapsayacak şekilde hiyerarşisiz, en az 3, en fazla 5 adet özerk konu kutusu (subject boxes) üret.

# KRİTİK GÜVENLİK BARIYERI
- Analizini gerçekleştirirken tamamen sağlanan matris verilerine sadık kal (Strictly Grounded). Kendi genel kültürünü, spekülasyonlarını veya matriste yer almayan harici konuları analize enjekte etme.
- Üreteceğin \`semanticSearchBlock\` alanlarının her birinin, OpenAlex vektör motorunu tam isabetle tetikleyecek, elit bir akademik İngilizce içeren bütünsel yapıda "Grant Aim" paragrafları olduğundan emin ol. Çıktıdaki başlık, açıklama ve kavram etiketleri ise tamamen Türkçe olmalıdır.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
