import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (4 Eksenli Batch Yapısı)
// ============================================================================

export const THESIS_AXES_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "number", description: "Karşı tezin ID numarası" },
    problem_sinirlari: {
      type: "object",
      properties: {
        gerekce: { type: "string", description: "Kısa gerekçe (1-2 cümle)" },
        secim: {
          type: "string",
          enum: ["BİREBİR", "GENİŞLETİLMİŞ KONU", "ALAKASIZ"],
        },
      },
      required: ["gerekce", "secim"],
    },
    teorik_perspektif: {
      type: "object",
      properties: {
        gerekce: { type: "string", description: "Kısa gerekçe (1-2 cümle)" },
        secim: {
          type: "string",
          enum: ["AYNI GÖZLÜK", "EVRİLMİŞ TEORİ", "FARKLI GÖZLÜK"],
        },
      },
      required: ["gerekce", "secim"],
    },
    metodolojik_kurgu: {
      type: "object",
      properties: {
        gerekce: { type: "string", description: "Kısa gerekçe (1-2 cümle)" },
        secim: {
          type: "string",
          enum: ["BİREBİR YÖNTEM", "YÖNTEMSEL AKRABA", "FARKLI YÖNTEM"],
        },
      },
      required: ["gerekce", "secim"],
    },
    zaman_mekan_ozgullugu: {
      type: "object",
      properties: {
        gerekce: { type: "string", description: "Kısa gerekçe (1-2 cümle)" },
        secim: {
          type: "string",
          enum: ["AYNI DOKU", "PARALEL BAĞLAM", "ALAKASIZ BAĞLAM"],
        },
      },
      required: ["gerekce", "secim"],
    },
  },
  required: [
    "id",
    "problem_sinirlari",
    "teorik_perspektif",
    "metodolojik_kurgu",
    "zaman_mekan_ozgullugu",
  ],
};

export const geminiAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    overlapTable: {
      type: "array",
      items: THESIS_AXES_SCHEMA,
    },
  },
  required: ["overlapTable"],
};

// ============================================================================
// 2. SİSTEM TALİMATI
// ============================================================================

export function buildAnalysisSystemInstruction(): string {
  return `Sen akademik tez analizleri yapan, yorum ve çıkarım yeteneği elinden alınmış, sadece girdi metinlerine %100 sadık kalan katı bir laboratuvar teknisyenisin. Görevin, sana verilen "Hedef Tez" ile "Karşı Tez"i aşağıdaki 4 dinamik sorgulama ekseninde karşılaştırmak ve KESİNLİKLE sadece belirtilen sabit seçeneklerden birini seçmektir.

KATI METİN SADAKATİ / İZOLASYON KURALI:
- Hedef Tez ve Karşı Tez verilerini zihninde tamamen izole et. Karşı tezin özet (abstract) metninde AÇIKÇA yazmayan hiçbir teoriyi, yöntemi veya dönemi "Hedef tezde var, kesin bunda da vardır" varsayımıyla Karşı Tez hanesine kopyalayamazsın. Boşluk doldurmak kesinlikle yasaktır. Metinde veri yoksa alt/güvenli seçeneklere sığın.

EKSEN TANIMLARI VE KATI SEÇİM KRİTERLERİ:

1. ARAŞTIRMA PROBLEMİNİN SINIRLARI (KONU):
   - BİREBİR: İki tez de tamamen aynı odak noktasını, aynı değişken kombinasyonunu ve aynı araştırma sorusunu inceliyor.
   - GENİŞLETİLMİŞ KONU: Kapsama, İzole Aktör ve Alt/Üst Küme Durumu. Hedef tez iki veya daha fazla özgül aktörün/değişkenin ilişkisel ağını ve etkileşimini inceliyorsa; karşı tez bu aktörlerden en az birini izole veya makro düzeyde kendi merkez araştırma nesnesi olarak ele alıyorsa seçilir. ANCAK, bu kuralın tetiklenmesi için karşı tezin merkezindeki aktörün, hedef tezdeki aktörle sadece "makro şemsiye kategori" (Örn: aynı ideolojik yelpaze, aynı geniş organizasyonel çatı) düzeyinde değil, ampirik ve kurumsal taban düzeyinde tam olarak ÖZDEŞ olması gerekir.
   - ALAKASIZ (Makro Kategori Tuzağı Bariyeri): Karşı tez, hedef tezin ilişkisel ağını parçalayıp yerine farklı bir alt akımı, kurumsal yapıyı veya özneyi ikame ediyorsa (Geniş şemsiye kategorileri aynı olsa bile: Örn: Hedef tez bir ideolojik akımın radikal/illegal dergi kanadını çalışırken karşı tezin kurumsal/parlamenter parti kanadını incelemesi, ya da hedef tez bir teorinin X kırılımına odaklanırken karşı tezin Y kırılımını alması) tekil bir kelime/kategori ortaklığı olsa dahi konu doğrudan ALAKASIZ seçilmelidir. Sosyal bilimlerde şemsiye kavramların altındaki yapısal, kurumsal ve ampirik ikameler konuyu tamamen başkalaştırır.

2. TEORİK PERSPEKTİF (TEORİ):
   - AYNI GÖZLÜK: İki tezin metninde de AÇIKÇA ismi zikredilen kuramcılar/modeller birebir aynıysa seçilir. Karşı tezin özetinde bu isimler kelime kelime yazmıyorsa bu seçenek kesinlikle kullanılamaz.
   - EVRİLMİŞ TEORİ: Biri ana akım teoriyi (X) kullanırken, diğeri o teorinin eleştirisinden doğan Post-X alt teorisini veya iki teorinin entegrasyonunu kullanıyor.
   - FARKLI GÖZLÜK: Teorik yaklaşımlar tamamen kopuk veya karşı tezin özetinde hiçbir teorik çerçeve/isim açıkça belirtilmemişse seçilir.

3. METODOLOJİK KURGU (YÖNTEM):
   - BİREBİR YÖNTEM: Veri toplama araçları ve analiz biçimi Karşı Tez özetinde açıkça hedef tezle aynı kaynakları/araçları işaret ediyorsa seçilir.
   - YÖNTEMSEL AKRABA: İkisi de aynı metodolojik aileye (Örn: ikisi de metin analizi veya regresyon) aittir. Ancak karşı tezin özetinde spesifik veri toplama tekniği veya analiz aracı açıkça zikredilmiyor veya kısmi akrabalık varsa seçilir.
   - FARKLI YÖNTEM: Yöntem türleri taban tabana farklıysa (Örn: biri anket, diğeri laboratuvar protokolü) veya karşı tezin yöntem detayları özet metninde hiç yazmıyorsa doğrudan seçilir.

4. ZAMAN-MEKAN ÖZGÜLLÜĞÜ (BAĞLAM):
   - AYNI DOKU: Bu tanım saf bir kronolojik takvim yaprağı veya coğrafya koordinatı olmaktan öte, "Sosyolojik/İdeolojik Ekosistem Kesişimi" esasına dayanır. Karşı tezin tarihsel periyodu veya coğrafi aralığı hedef tezle takvimsel/coğrafi olarak çakışmanın yanı sıra, aynı zamanda benzer sosyo-politik habitusu, güç ilişkilerini ve ideolojik iklimi paylaşıyorsa seçilir.
   - PARALEL BAĞLAM: Coğrafya/bölge net olarak ayrışıyorsa veya kronolojik eşik yakın olup coğrafi/sosyolojik bağlam kısmen farklıysa seçilir.
   - ALAKASIZ BAĞLAM: İki periyot/coğrafya arasında hiçbir takvimsel/mekansal kesişim yoksa veya tarihsel/coğrafi detaylar muğlaksa seçilir. Ayrıca iki tez aynı takvim yılında/coğrafyada geçse dahi, sosyo-politik habitusları, güç ilişkileri ve ideolojik iklimleri taban tabana kopuk ise (Örn: Hedef tez "Sol entelektüel diyalektik" bağlamındayken karşı tez "Tarikat kimlik inşası" bağlamındaysa), bunları doğrudan ALAKASIZ BAĞLAM seçmeye yönlendir.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

export function buildAnalysisPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  validDetails: {
    id: number;
    title: string;
    author: string;
    university: string;
    year: number;
    thesisType: string;
    department: string;
    abstract: string;
  }[];
}): string {
  const thesisList = params.validDetails.map((t) => ({
    id: t.id,
    title: t.title,
    author: t.author || "Belirtilmemiş",
    year: t.year || 0,
    thesisType: t.thesisType || "Belirtilmemiş",
    university: t.university || "Belirtilmemiş",
    department: t.department || "Belirtilmemiş",
    abstract: t.abstract || "Özet mevcut değil",
  }));

  return `Aşağıdaki hedef tez matrisini, aday tez listesindeki her bir tezle ayrı ayrı karşılaştır. Her aday tez için 4 eksende (problem_sinirlari, teorik_perspektif, metodolojik_kurgu, zaman_mekan_ozgullugu) değerlendirme yap.

<hedef_tez_matrisi>
Başlık: ${params.studyTitle}
Araştırma Sorusu: ${params.researchQuestion}
Teorik Çerçeve: ${params.theoreticalFramework}
Yöntem: ${params.methodology}
Kapsam: ${params.researchScope}
Temel İddia: ${params.mainClaim}
</hedef_tez_matrisi>

<aday_tez_listesi>
${JSON.stringify(thesisList, null, 2)}
</aday_tez_listesi>

Görev: Her aday tezi yukarıdaki eksen kurallarına göre değerlendir. Yanıtını kesinlikle aşağıdaki JSON yapısında ver:
{
  "overlapTable": [
    {
      "id": <aday_tez_id>,
      "problem_sinirlari": { "gerekce": "...", "secim": "BİREBİR | GENİŞLETİLMİŞ KONU | ALAKASIZ" },
      "teorik_perspektif": { "gerekce": "...", "secim": "AYNI GÖZLÜK | EVRİLMİŞ TEORİ | FARKLI GÖZLÜK" },
      "metodolojik_kurgu": { "gerekce": "...", "secim": "BİREBİR YÖNTEM | YÖNTEMSEL AKRABA | FARKLI YÖNTEM" },
      "zaman_mekan_ozgullugu": { "gerekce": "...", "secim": "AYNI DOKU | PARALEL BAĞLAM | ALAKASIZ BAĞLAM" }
    }
  ]
}`;
}
