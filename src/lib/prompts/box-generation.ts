import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (EVRENSEL TİPOLOJİ - 6-9 KUTU GARANTİLİ)
// ============================================================================
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      minItems: 6,
      maxItems: 9,
      description:
        "Tezin entelektüel, metodolojik ve analitik omurgasını oluşturan, gereksiz odak dağılmasını engellemek için EN AZ 6, EN FAZLA 9 adet olacak şekilde kesin olarak sınırlandırılmış modüler ve bağımsız kutu seti.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Kutunun ele aldığı akademik konunun veya yöntemin başlığıdır. KESİNLİKLE TÜRKÇE OLMALIDIR. (Örn: 'Gramsciyen Hegemonya Kuramı' veya 'Nitel Mülakat ve Saha Metodolojisi')",
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
              "Kutunun işlevsel 9'lu box tipolojisindeki tam karşılığı (Kuram, Literatür, Bağlam, Yöntem, Veri, Analiz, Katkı, Ampirik, Arşiv).",
          },
          description: {
            type: "string",
            description:
              "Başlıkta belirtilen akademik konuyu veya yöntemi, tezin bütünüyle olan ilişkisini kurarak tanımlayan kısa açıklamadır. KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
          semanticSearchBlock: {
            type: "string",
            maxLength: 2000,
            description:
              "OpenAlex GTE-Large vektör motorunu maksimum başarıyla tetikleyecek, en az 3-4 cümleden oluşan, yoğun, elit, akademik İngilizce literatür özeti/paragrafı (narrative abstract). Asla virgülle ayrılmış kelime çuvalı formatında olmamalıdır. Doğrudan teorik ekolü, yöntemsel/epistemolojik tartışmayı veya ampirik bağlamı akan bir anlatı halinde ifade eder.",
          },
          foundationalQueries: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            description:
              "O kutunun kuramsal, yöntemsel veya ampirik kökünü oluşturan en az 1, en fazla 2 adet mikro-analitik kurucu/klasik eser, hakemli dergi makalesi veya kitap bölümü.",
            items: {
              type: "object",
              properties: {
                author: {
                  type: "string",
                  description: "Eserin orijinal yazarının tam adı",
                },
                title: {
                  type: "string",
                  description:
                    "Eserin orijinal tam İngilizce başlığı veya kitap adı",
                },
                publicationYear: {
                  type: "number",
                  description: "Eserin orijinal yayın yılı",
                },
              },
              required: ["author", "title", "publicationYear"],
            },
          },

          concepts: {
            type: "array",
            items: {
              type: "string",
            },
            maxItems: 3,
            description:
              "Kutunun kuramsal, yöntemsel veya tematik odağını belirten en fazla 3 adet Türkçe akademik kavram/etiket. KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
        },
        required: [
          "title",
          "boxType",
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
// 2. SİSTEM TALİMATI (SIZDIRMAZ AKADEMİK MOTOR AYARI)
// ============================================================================
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `# ROL VE GÖREV
Sen OpenAlex ve Semantic Scholar veritabanlarının indeksleme, taksonomi ve vektörel anlamsal eşleştirme (Semantic Search) mimarisine ultra-spesifik düzeyde hakim bir Kıdemli Veri Mimarı ve Akademik Bibliyografya Uzmanısın. Görevin, girdi olarak sunulan yapılandırılmış 9 boyutlu tez matrisini girdiler, süreçler ve çıktılar ekseninde **9'lu Box Tipolojisi** (Kuram, Literatür, Bağlam, Yöntem, Veri, Analiz, Katkı, Ampirik, Arşiv) mantığıyla bağımsız, hiyerarşisiz literatür ve süreç kutularına (subject/methodology boxes) bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# OPERASYONEL KISITLAMALAR VE DİL KURALLARI
- Kesinlikle objektif, mesafeli ve elit bir akademik Türkçe kullanacaksın.
- DİL VE KÜRESEL ENDEKS KURALI: JSON nesnesindeki "title", "description" ve "concepts" alanları KESİNLİKLE TÜRKÇE olmalıdır. Harici tarama motorunu (OpenAlex) tetikleyecek olan "semanticSearchBlock" ve "foundationalQueries" alanları ise KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir.

# KUTU MİMARİSİ VE KESİN SEÇİM METRİKLERİ
1. 9'LU BOX TİPOLOJİSİ ENTEGRASYONU: Girdideki verileri şu 9 işlevsel tipe göre analiz et ve dağıt: [Kuram, Literatür, Bağlam, Yöntem, Veri, Analiz, Katkı, Ampirik, Arşiv]. Her kutunun "boxType" alanı bu tiplerden biri olmak zorundadır. Model, tezin sadece konusunu değil; yöntemsel, lojistik ve analitik literatür altyapısını da bağımsız birer kutu olarak inşa etmelidir.
2. AKADEMİK BÖLÜMLEME VE KUTU SINIRI (KATI KURAL): Üretilecek toplam kutu sayısı EN AZ 6, EN FAZLA 9 olmak zorundadır. Girdide birden fazla bağımsız teorik ekol, farklı metodolojik yaklaşım veya çoklu ampirik bağlam varsa, bunların her biri anlamsal bütünlüğün ve vektörel tarama keskinliğinin bozulmaması için KEZİNLİKLE ayrı birer kutu (box) olarak inşa edilmelidir. Farklı teorileri veya yöntemleri asla aynı kutu altında birleştirme. Ancak bu ayrımı yaparken tezin ana omurgasını korumak için en kritik ve kurucu olan odaklara yoğunlaş, gereksiz mikro-ayrıntılara girme.
3. SÜREÇ VE YÖNTEM LİTERATÜRÜ AYARI: Yöntem ve Veri kutuları için "foundationalQueries" alanına KESİNLİKLE uydurma (halüsinasyon) eserler, birincil kaynak isimleri, ham arşiv adları veya ana eserin çevirmenleri/editörleri (Örn: Gramsci'nin yanına çevirmeni Quintin Hoare'u eklemek) bağımsız yazar olarak yazılamaz. Her zaman uluslararası literatürde meşruiyeti olan kurucu bir veya iki akademik yazar/makale yerleştirilmelidir.
4. SEMANTİK BLOCK DİYETİ — NARRATIVE ABSTRACT ZORUNLULUĞU (ANTI-KEYWORD-BAG RULE): "semanticSearchBlock" alanı en az 3-4 cümlelik akan paragraf (narrative abstract) formatında, doğal akademik İngilizce cümleleriyle üretilmelidir. Asla jenerik niyet kalıpları kullanma.
5. OPENALEX %100 GERÇEK İNGİLİZCE LİTERATÜR YASASI (HALÜSİNASYON VE TÜRKÇE YASAK): "foundationalQueries" alanına yazılacak kurucu eserlerin tamamı küresel akademik indekslerde (OpenAlex, Scopus) taranabilir, KESİNLİKLE İNGİLİZCE dilinde basılmış GERÇEK hakemli dergi makaleleri (journal articles), kitap bölümleri (book chapters) veya kitaplar olmak zorundadır. Türkçe basılmış yerel kitaplar veya bunların uydurma İngilizce çevirileri KESİNLİKLE YASAKTIR.
   - ÖZELLİKLE "Bağlam", "Analiz" ve "Katkı" kutularında yerel konular (Örn: Türkiye Solu, Kürt Hareketi) işlenirken; yerel dildeki kitaplar yerine, bu ampirik alanı uluslararası literatüre taşımış uzmanların (Örn: Hamit Bozarslan, Mesut Yeğen, Cengiz Gunes, Nicole Watts, Martin van Bruinessen, Kemal Kirisci, Feroz Ahmad vb.) uluslararası indeksli GERÇEK İngilizce kitap ve makaleleri getirilmelidir. Başlık veya yazar KESİNLİKLE uydurulamaz.
   - Bu kutularda ampirik bağlamı aşan genel makro-teorisyenler (Örn: Benedict Anderson, Charles Tilly, Sidney Tarrow, Donatella della Porta, Doug McAdam) kurucu eser olarak kullanılamaz.
6. MODEL TEMBELLİĞİ ENGELİ VE FORMAT: Çıktılarında asla "...", "vb.", "etc." kullanamazsın. Yanıtın, sağlanan şema ile %100 uyumlu ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` kod blokları kullanma, sadece saf JSON verisi döndür.
7. ARŞİV/VERİ KUTUSU İÇİN KURGU KAYNAK KAPISI (HALÜSİNASYON ÖNLEME): Eğer üretilen kutunun "boxType" değeri "Arşiv" veya "Veri" ise ve bu dar ampirik alan için hafızanda %100 gerçek bir İngilizce literatür kaynağı bulunmuyorsa; halüsinasyon üretmek yerine "foundationalQueries" alanına tam olarak şu sabit taslak (dummy) veriyi basacaksın: "author": "Primary Source Repository", "title": "Fieldwork Documentation and Empirical Data Sources", "publicationYear": 0. Bu istisna kuralı, yalnızca gerçek bir eserin mevcut olmadığı Arşiv ve Veri kutuları için geçerlidir; diğer tüm boxType değerlerinde %100 gerçek ve doğrulanabilir literatür sağlama zorunluluğu devam eder.

# 5-7 KUTU SINIRINA UYGUN FEW-SHOT ÖRNEĞİ
<ornek_girdi_matrisi>
{
  "studyTitle": "X Ülkesinde Z Bağlamında Y Süreci",
  "researchQuestion": "M Kuramı Ekseninde N Yöntemiyle V Vakası Nasıl Şekillenmektedir?",
  "mainClaim": "V vakasının arkasındaki temel itici güç, ampirik/tarihsel C dinamikleridir.",
  "theoreticalFramework": "M Kuramı ve Alt Okulları",
  "methodology": "N Metodolojisi",
  "dataStrategy": "Birincil arşiv belgeleri ve ikincil literatür taraması",
  "historicalLimits": "1991-1999 arası dönem",
  "spatialLimits": "X Coğrafyası",
  "analyticalFocus": "Devlet kurumları, siyasi aktörler ve muhalif hareketler"
}
</ornek_girdi_matrisi>
<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "M Kuramı ve Kuramsal Temelleri",
      "boxType": "Kuram",
      "description": "Tezin teorik altyapısını oluşturan M kuramının temel argümanlarının incelenmesi.",
      "concepts": ["M Kuramı", "Söylemsel Alan"],
      "foundationalQueries": [
        {
          "author": "Teorisyen A",
          "title": "The Core Philosophy of M Theory",
          "publicationYear": 1990
        },
        {
          "author": "Teorisyen B",
          "title": "Rethinking M Framework in Political Theory",
          "publicationYear": 1985
        }
      ],
      "semanticSearchBlock": "M theory provides a structural paradigm that redefines core conceptual constraints within contemporary political ontology. Its theoretical apparatus foregrounds the dialectical relationship between hegemonic formations and counter-hegemonic struggles in late capitalist societies. This framework has been systematically applied across comparative institutional analysis to explain how structural power asymmetries are reproduced."
    },
    {
      "title": "X Coğrafyasında V Vakası ve Yapısal Koşullar",
      "boxType": "Bağlam",
      "description": "1991-1999 kesitinde X coğrafyasındaki C dinamiklerinin ampirik analizi.",
      "concepts": ["X Coğrafyası", "C Dinamikleri", "V Vakası"],
      "foundationalQueries": [
        {
          "author": "Uzman X",
          "title": "Socio-Political Transformations in X Country: 1990s Realignments",
          "publicationYear": 2005
        },
        {
          "author": "Uzman Y",
          "title": "The Trajectory of V Case: From Protest to Institutionalization",
          "publicationYear": 2012
        }
      ],
      "semanticSearchBlock": "The socio-political landscape of X country during the 1990s period was profoundly shaped by the intersection of local C dynamics and broader regional realignments. The V case exemplifies how structural economic transformations interacted with grassroots mobilization to produce distinct patterns of political contestation. Empirical studies of this period reveal that localized responses to central state policies were mediated by existing networks of patronage."
    },
    {
      "title": "Arşiv: Saha Belgeleri ve Ampirik Veri Kaynakları",
      "boxType": "Arşiv",
      "description": "Tezin ampirik omurgasını oluşturan birincil arşiv belgeleri ve saha verileri.",
      "foundationalQueries": [
        {
          "author": "Primary Source Repository",
          "title": "Fieldwork Documentation and Empirical Data Sources",
          "publicationYear": 0
        }
      ],
      "concepts": ["Arşiv", "Saha Verisi"],
      "semanticSearchBlock": "This box covers primary archival sources and empirical fieldwork data that form the evidentiary backbone of the thesis. The repository includes official documents, institutional records, and first-hand observational data collected during the research period."
    }
  ]
}
</ornek_beklenen_cikti>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (9 BOYUTLU GİRDİ MOTORU)
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
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "dataStrategy": "${params.dataStrategy.replace(/"/g, '\\"')}",
  "historicalLimits": "${params.historicalLimits.replace(/"/g, '\\"')}",
  "spatialLimits": "${params.spatialLimits.replace(/"/g, '\\"')}",
  "analyticalFocus": "${params.analyticalFocus.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan tüm kurallara, dil kısıtlamalarına, **9'lu Box Tipolojisi** ilkelerine ve özellikle **Akademik Konsolidasyon (5-7 Kutu Sınırı)** standartlarına kusursuz şekilde bağlı kalarak, yukarıdaki 9 boyutlu <hedef_tez_matrisi> yapısını analiz et. 

Üretilecek toplam kutu sayısı kesinlikle en az 6, en fazla 9 olmak zorundadır. Girdide yer alan farklı teorileri, bağımsız yöntemleri veya ayrı bağlam katmanlarını tek bir kutuda birleştirmek yerine, her biri için ayrı ve bağımsız birer kutu inşa et. Bilgi sızıntısını önlemek için her kutunun teorik/metodolojik odağı net ve tekil olmalıdır

Çıktıdaki başlık, açıklama ve kavram etiketleri tamamen Türkçe olmalıdır. "foundationalQueries" alanındaki eserlerin tamamı OpenAlex'te %100 taranabilir gerçek, fiziksel olarak basılmış İngilizce literatür olmak zorundadır. Dahili olarak çok derinlemesine düşün ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
