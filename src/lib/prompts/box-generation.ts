import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (EVRENSEL VE DENGELİ YAPILANDIRMA)
// ============================================================================
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      minItems: 6,
      maxItems: 9,
      description:
        "Tezin entelektüel, metodolojik ve ampirik omurgasını oluşturan, gereksiz odak dağılmasını engellemek için modüler ve birbirini tekrar etmeyen bağımsız kutu seti.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Kutunun ele aldığı akademik konunun, kuramın veya yöntemin Türkçe başlığı. (Örn: 'X Kuramı ve Temelleri')",
          },
          boxType: {
            type: "string",
            enum: [
              "Kuram",
              "Literatür",
              "Bağlam",
              "Yöntem",
              "Veri",
              "Analiz",
              "Katkı",
              "Ampirik",
              "Arşiv",
            ],
            description:
              "Kutunun işlevsel akademik tipolojideki tam karşılığı.",
          },
          description: {
            type: "string",
            description:
              "Kutunun içeriğini, sınırlarını ve inceleme alanını tanımlayan net Türkçe açıklama. Tezin spesifik ampirik bağlamıyla kuramsal tanımları birbirine karıştırmadan, kutunun özünü anlatmalıdır.",
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
            description:
              "Kutunun odağını belirten Türkçe akademik anahtar kavramlar/etiketler.",
          },
          semanticSearchBlock: {
            type: "string",
            maxLength: 2000,
            description:
              "OpenAlex ve küresel veritabanlarında semantik aramayı (Semantic Search) maksimum başarıyla tetikleyecek, en az 3-4 cümlelik, yoğun, elit akademik İngilizce literatür özeti/paragrafı (narrative abstract).",
          },
          foundationalQueries: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            description:
              "O kutunun kuramsal, yöntemsel veya ampirik kökünü oluşturan, uluslararası indekslerde taranabilir kurucu/klasik eserler.",
            items: {
              type: "object",
              properties: {
                author: { type: "string", description: "Yazarın tam adı" },
                title: {
                  type: "string",
                  description:
                    "Eserin orijinal tam İngilizce başlığı veya kitap adı",
                },
                publicationYear: {
                  type: "number",
                  description: "Orijinal yayın yılı",
                },
              },
              required: ["author", "title", "publicationYear"],
            },
          },
        },
        required: [
          "title",
          "boxType",
          "description",
          "concepts",
          "semanticSearchBlock",
          "foundationalQueries",
        ],
      },
    },
  },
  required: ["boxes"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (AKADEMİK VE DİNAMİK YÖNLENDİRME)
// ============================================================================
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `# ROL VE GÖREV
Sen, akademik literatür haritalama, bibliyografik taksonomi ve vektörel anlamsal eşleştirme (Semantic Search) mimarisine üst düzeyde hakim bir Kıdemli Araştırma Mimarısın. 
Görevin, girdi olarak sunulan tezin ana parametrelerini (matrisini) incelemek ve bu tezin kuramsal, yöntemsel ve ampirik omurgasını oluşturacak en az 6, en fazla 9 adet bağımsız "Akademik Kutu" (Thesis Box) üretmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# OPERASYONEL İLKELER VE DİL KURALLARI
1. DİL DENGESİ: Üretilen JSON nesnesindeki "title", "description" ve "concepts" alanları KESİNLİKLE TÜRKÇE olmalıdır. Harici küresel tarama motorlarını tetikleyecek olan "semanticSearchBlock" ve "foundationalQueries" alanları ise KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir.
2. BAĞIMSIZ ADALAR KURALI (MANTIKSAL İZOLASYON): Her kutu, tezin bütününe hizmet eden ama kendi içinde tamamen bağımsız bir çalışma alanı/ada (standalone island) olarak kurgulanmalıdır.
3. KURAM VE YÖNTEM ARINDIRMASI (CONTEXT STRIPPING): Kutu tipi "Kuram" veya "Yöntem" olduğunda, "semanticSearchBlock" alanı sadece o teorinin veya metodolojinin dünyadaki evrensel, soyut ve saf literatür karşılığını (bir ders kitabı veya ansiklopedi tanımı gibi) içermelidir. Tezin yerel, coğrafi veya spesifik ampirik bağlamı bu iki kutu tipinin semantik bloklarına kesinlikle sızmamalıdır. Tezin yerel bağlamı, vakaları ve spesifik analizi; "Bağlam", "Analiz", "Ampirik" veya "Arşiv" kutularına saklanmalıdır.
4. TEORİK BÖLÜMLEME GÜVENCESİ: Girdide birden fazla bağımsız teorik ekol, kavramsal çerçeve veya farklı metodolojik yaklaşım varsa, bunların her biri anlamsal bütünlüğün bozulmaması için kesinlikle ayrı birer kutu (box) olarak inşa edilmelidir. Farklı teorileri veya yöntemleri tek bir kutu altında birleştirme.
5. SEMANTİK BLOK KALİTESİ: "semanticSearchBlock" alanı en az 3-4 cümlelik, bir makale özeti akıcılığında (narrative abstract) doğal İngilizce cümleleriyle yazılmalıdır. Asla kelime çuvalı veya jenerik niyet kalıpları içermemelidir. Metin içinde kurallara uyulduğunu kanıtlamaya çalışan yapay meta-açıklamalara (örn: 'without geographical reference') yer verilmemelidir.
6. GERÇEK LİTERATÜR ZORUNLULUĞU: "foundationalQueries" alanına yazılacak kurucu eserlerin tamamı küresel akademik indekslerde taranabilir, KESİNLİKLE İNGİLİZCE dilinde basılmış GERÇEK ve saygın kaynaklar olmak zorundadır. Kitap incelemeleri (book review) kurucu eser olarak yazılamaz.
7. ARŞİV/VERİ İÇİN SABİT DUMMY KAPASI: Eğer üretilen kutunun tipi "Arşiv" veya "Veri" ise ve bu dar ampirik alan için hafızanda %100 gerçek bir İngilizce literatür kaynağı bulunmuyorsa; halüsinasyon üretmek yerine "foundationalQueries" alanına tam olarak şu sabit taslak veriyi basacaksın:
   "author": "Primary Source Repository", "title": "Fieldwork Documentation and Empirical Data Sources", "publicationYear": 0

# 6-9 KUTU SINIRINA UYGUN ÖRNEK MİMARİ
<ornek_girdi_matrisi>
{
  "studyTitle": "X Ülkesinde Z Bağlamında Y Süreci",
  "researchQuestion": "M Kuramı Ekseninde N Yöntemiyle V Vakası Nasıl Şekillenmektedir?",
  "mainClaim": "V vakasının arkasındaki temel itici güç, ampirik ve tarihsel C dinamikleridir.",
  "theoreticalFramework": "M Kuramı ve Alt Yaklaşımları",
  "methodology": "N Metodolojisi",
  "dataStrategy": "Birincil arşiv belgeleri ve saha çalışması",
  "historicalLimits": "Belirli bir tarih aralığı",
  "spatialLimits": "Belirli bir coğrafya",
  "analyticalFocus": "Kurumsal aktörler ve toplumsal süreçler"
}
</ornek_girdi_matrisi>

<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "M Kuramı ve Temel Paradigmaları",
      "boxType": "Kuram",
      "description": "Tezin teorik altyapısını oluşturan M kuramının temel iddialarının, kavramsal sınırlarının ve ana varsayımlarının incelenmesi.",
      "concepts": ["M Kuramı", "Yapısal Paradigmalar"],
      "foundationalQueries": [
        {
          "author": "Teorisyen A",
          "title": "The Core Philosophy of M Theory",
          "publicationYear": 1990
        }
      ],
      "semanticSearchBlock": "M theory provides a structural paradigm that redefines core conceptual constraints within contemporary political ontology. Its theoretical apparatus foregrounds the relationship between structural formations and agency in modern societies. This framework has been systematically applied across comparative analysis to explain how institutional dynamics are reproduced independent of localized variations."
    },
    {
      "title": "Z Bağlamında C Dinamikleri ve Tarihsel Koşullar",
      "boxType": "Bağlam",
      "description": "Tezin ampirik zeminini oluşturan belirli zaman kesitinde Z bağlamındaki C dinamiklerinin analizi.",
      "concepts": ["Z Bağlamı", "C Dinamikleri", "V Vakası"],
      "foundationalQueries": [
        {
          "author": "Uzman X",
          "title": "Socio-Political Transformations in Z Context",
          "publicationYear": 2005
        }
      ],
      "semanticSearchBlock": "The socio-political landscape of the designated region was profoundly shaped by the intersection of local C dynamics and broader systemic shifts. The V case exemplifies how structural transformations interacted with grassroots mobilization to produce distinct patterns of contestation. Empirical studies reveals that localized responses were mediated by existing institutional networks and historical legacies."
    }
  ]
}
</ornek_beklenen_cikti>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (YALIN VE DİNAMİK MOTOR)
// ============================================================================
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
}): string {
  const matrixJson = JSON.stringify(
    {
      studyTitle: params.studyTitle,
      researchQuestion: params.researchQuestion,
      mainClaim: params.mainClaim,
      theoreticalFramework: params.theoreticalFramework,
      methodology: params.methodology,
      dataStrategy: params.dataStrategy,
      historicalLimits: params.historicalLimits,
      spatialLimits: params.spatialLimits,
      analyticalFocus: params.analyticalFocus,
    },
    null,
    2,
  );

  return `START_THESIS_MATRIX\n${matrixJson}\nEND_THESIS_MATRIX\n\n# GÖREV VE TALİMAT\nSistem talimatında tanımlanan hafif kısıtlamalara, dil dengesine ve bağımsız adalar ilkelerine tam olarak bağlı kalarak yukarıdaki 9 boyutlu matris yapısını analiz et.\n\nTezin tüm teorik, metodolojik ve ampirik boyutlarını tam olarak kapsayan, birbirini tekrar etmeyen, en az 6 en fazla 9 kutudan oluşan dengeli bir set üret.\n\nKuram ve Yöntem kutularının akademik İngilizce semantik arama bloklarını kurgularken, tezin yerel/coğrafi kokusunu tamamen dışarıda bırakarak saf kavramsal teoriyi ve evrensel tanımı yakala. Çıktı olarak sadece ve sadece tanımlanan şemaya %100 uygun, markdown içermeyen saf JSON nesnesini döndür.`;
}
