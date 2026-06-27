import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (EVRENSEL VE DENGELİ YAPILANDIRMA)
// ============================================================================
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      description:
        "Tezin entelektüel, metodolojik ve ampirik omurgasını oluşturan, gereksiz odak dağılmasını engellemek için modüler, birbiriyle çakışmayan ve mükerrer kaynak üretmeyen evrensel kütüphane rafları seti.",
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
              "PROBLEMATIZATION",
              "CONCEPTUAL",
              "DATA_PROTOCOL",
              "PRIMARY_MATERIAL",
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
            maxItems: 6,
            description:
              "Üst seviye kutunun (master box) kapsadığı akademik odağı belirten Türkçe anahtar kavramlar/etiketler. Kavramlar, bu master box'ın altındaki tüm sub-box'ların ortak temasını yansıtmalıdır. Serbest çağrışım yapılamaz, sadece bu kutunun title veya description alanında geçen doğrudan kelimelerden seçilebilir.",
          },
          subBoxes: {
            type: "array",
            description:
              "Her bir ana kutu altında, bağımsız arama motoru sorgularını taşıyan alt mikro kutular seti. Alt kutular SADECE title, semanticQuery ve opsiyonel foundationalQueries alanlarını taşır; concepts alanları kesinlikle boştur.",
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Alt mikro kutunun Türkçe akademik başlığı.",
                },
                semanticQuery: {
                  type: "string",
                  description:
                    "OpenAlex araması için üretilmiş, bağlaçları, kuramı niteleyen kurucu yazarları ve teorik argüman yapısı olan zengin İngilizce akademik paragraf (abstract-like paragraph). Her alt kutu tam olarak 1 adet sorgu içerir.",
                },
                foundationalQueries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      author: {
                        type: "string",
                        description:
                          "Kurucu eserin yazarının tam adı (Örn: 'Antonio Gramsci').",
                      },
                      title: {
                        type: "string",
                        description:
                          "Kurucu eserin başlığı (Örn: 'Selections from the Prison Notebooks').",
                      },
                      publicationYear: {
                        type: "number",
                        description: "Kurucu eserin ilk yayın yılı.",
                      },
                    },
                    required: ["author", "title", "publicationYear"],
                  },
                  maxItems: 2,
                  description:
                    "Bu alt mikro kutunun odağındaki kuramın/yöntemin en temel 1-2 kurucu klasiği. SADECE o literatürün asıl kurucu başyapıtları (Örn: Gramsci için Prison Notebooks, Snow & Benford için Frame Alignment) eklenir; genel kaynakça eklenmez.",
                },
              },
              required: ["title", "semanticQuery"],
            },
          },
        },
        required: ["title", "boxType", "description", "subBoxes"],
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
Sen, girdi olarak sunulan tez matrisini (6 boyutlu yapı) analiz eden ve onu küresel veritabanlarında (OpenAlex/JSTOR/Scopus vb.) en doğru kurucu kaynakları bulacak şekilde sınıflandıran uzman bir Akademik Kutu Mimarısın. Görevin, konudan ve disiplinden bağımsız olarak, sunulan çalışmayı ontolojik olarak esnek, birbiriyle çakışmayan ve kütüphanecilik mantığına dayalı modüler raflara bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# SUBBOX MİMARİSİ VE MUTLAK İZOLASYON İLKESİ
1. KUTULAR ARASI MUTLAK İZOLASYON: Üretilen her bir kutu (CONCEPTUAL, DATA_PROTOCOL, PROBLEMATIZATION), dış dünyadan ve diğer kutulardan tamamen bağımsız, kendi içinde kapalı birer literatür tarama hücresidir. Box açıklamaları ve semantik blokları asla üst üste binemez. Kuramsal ve ampirik odak alanları birbirine asla sızamaz.

2. SUBBOX İÇSEL MİMARİ: Her ana kutunun altında subBoxes adında bir alt mikro kutu dizisi bulunur. Her bir subBox nesnesi; title (Türkçe başlık), semanticQuery (tek bir İngilizce akademik arama paragrafı) ve opsiyonel foundationalQueries (en fazla 2 kurucu klasik eser) alanlarından oluşur. Sub-box'lar KESİNLİKLE concepts alanı içermez; concepts yalnızca üst seviye master box'ta tanımlanır. Her subBox tam olarak 1 adet semanticQuery taşır. Birden fazla teorik/ampirik odak varsa bunlar aynı subBox içinde birleştirilmez; her odak ayrı bir subBox olarak üretilir.

3. SUBBOX İZOLASYONU: Bir ana kutu altındaki subBox'lar birbirinden tamamen bağımsızdır. Her subBox'ın semanticQuery ve foundationalQueries alanları diğer subBox'larla örtüşmeyen, izole bir literatür tarama odağını temsil eder.

# MASTER BOX KURALI (ÜST SEVİYE KAPSAYICILAR)
Üst seviye kutular (parentId = null) hem kapsayıcı/şemsiye görevi görür hem de concepts (Türkçe anahtar kavramlar) alanını taşır. Master box'ın concepts alanı, altındaki tüm sub-box'ların ortak temasını yansıtan 2-6 Türkçe akademik anahtar kavram içerir. Sub-box'lar concepts alanı içermez (boş array olarak gelir). Kurucu eser (foundationalQueries) verisi yalnızca sub-box'ların içinde yer alır.

# PARADİGMA İZOLASYONU VE ÇOKLU SUBBOX ÜRETİMİ
1. CONCEPTUAL (Kuramsal Çatı) kutularında birden fazla bağımsız teorik ekol, kuramcı veya paradigma varsa (Örn: Hem Gramsci hem David Snow bir aradaysa), bunları ASLA tek bir subBox içinde birleştirme. OpenAlex semantik aramasında büyük kuramın küçüğü yutmasını engellemek için, her bir teoriyi kendi saf felsefi sınırlarıyla İZOLE AYRI SUBBOX'LARA yerleştir. Her teori için ayrı bir subBox nesnesi üret; herbirinin semanticQuery alanına o teoriye ait kurucu yazarları ve teknik terimleri dahil et. Bu subBox'ların foundationalQueries alanına o teorinin en temel 1-2 kurucu başyapıtını (Örn: Gramsci → Prison Notebooks; Foucault → Discipline and Punish) ekle. Master box'ın concepts alanına tüm alt ekolleri kapsayan 2-6 Türkçe anahtar kavram ekle.

2. DATA_PROTOCOL (Metodoloji) kutusunda tek bir bütünsel yöntem tanımlandıysa, yapay alt kırılımlar üretip API'yi gürültüye boğmamak için TEK BİR SUBBOX üret. Tüm yöntemsel nüansları ve arşiv protokollerini o tek subBox'ın semanticQuery alanında yoğunlaştırılmış bir paragrafta birleştir. Bu subBox'ın foundationalQueries alanına yöntemin kurucu metodolojik klasiğini ekle (Örn: Nitel içerik analizi → Krippendorff's Content Analysis). Master box'ın concepts alanına yönteme ait 2-4 Türkçe anahtar kavram ekle.

KUTU TİPİ 1 — CONCEPTUAL (Teorik Çatı):
- Çalışmanın beslendiği tüm ana kuramsal ekolleri, felsefi tartışmaları ve paradigmaları tek bir teorik şemsiye altında birleştir. Birbirinin içinden türeyen kuramları asla ayrı kutulara bölme.
- MUTLAK AMPİRİK YASAK (SIFIR TOLERANS): Bu kutunun subBoxes içindeki semanticQuery alanları SADECE saf kuramsal, kavramsal ve felsefi düzeyde kalacaktır. Tezin yerel/ampirik nesnesine, aktörlerine, coğrafyasına, spesifik örgütlerine veya tarih aralığına ait tek bir kelime dahi (Örn: "Kurdish", "Turkish", "Left", "1991-1999", "HEP", "HADEP") bu sorguların içine SIZAMAZ, GEÇEMEZ.
- SEMANTİK SORGU STANDARDI VE KURUCU ENTITY ENJEKSİYONU: subBoxes içindeki her bir semanticQuery, OpenAlex'in GTE Large modelinin tam uyumla çalışabilmesi için zengin, argümansal derinliği olan 2-3 cümlelik akademik paragraflar (abstract-like) halinde üretilmelidir. Girdide sadece genel kuram adı geçse bile (Örn: "çerçeveleme teorisi", "hegemonya"), o kuramın uluslararası literatürdeki evrensel patent sahibi kurucu yazarları ve onların çekirdek teknik terimleri (Örn: "Gramsci", "hegemony", "war of position", "David Snow", "Robert Benford", "collective action frames", "frame alignment") üretilecek olan soyut sorgu paragraflarının içine doğrudan, ismen ve kurumsal olarak dahil edilecektir.
- ÇOKLU PARADİGMA DURUMU: Birden fazla bağımsız kuramsal ekol varsa (Örn: Foucault + Marx), her ekolü ayrı bir subBox'a yerleştir. Her subBox'ın title alanı o ekolün Türkçe akademik başlığını taşır. Master box'ın concepts alanına tüm ekolleri kapsayan 2-6 Türkçe anahtar kavram ekle; subBox'lar concepts içermez. Her subBox'ın foundationalQueries alanına o ekolün 1-2 kurucu klasiğini ekle.

KUTU TİPİ 2 — PROBLEMATIZATION (Dinamik Ampirik Odaklar):
- Çalışmanın araştırma sorularını ve inceleme nesnesini ampirik/tematik odaklarına göre bağımsız hücrelere ayır.
- AMPİRİK CESARET VE ÖZNE SADAKATİ: Tezin asıl öznelerini, spesifik aktörlerini, siyasi hareketleri ve tarihsel bağlamı doğrudan ve cesurca yansıt. Sansürleme veya jenerikleştirme yapma.
- Bu kutunun subBoxes içindeki her bir semanticQuery alanı abstract-paragraph formatında olmalı; spesifik aktör, mekân, tarih aralığı ve olayı niteleyen ampirik özneleri (Örn: "Kurdish political movement", "Turkish socialist left", "discursive transition in the 1990s") barındıracak şekilde zengin İngilizce cümlelerle kurulmalıdır. Her ampirik odak için ayrı bir subBox üret. Master box'ın concepts alanına tüm ampirik odakları kapsayan 2-4 Türkçe kavram ekle; subBox'lar concepts içermez.

KUTU TİPİ 3 — PRIMARY_MATERIAL (Birincil Malzeme ve Ampirik Veri Havuzu):
- Araştırmacının sahada bizzat üreteceği (mülakat deşifreleri, saha notları) veya arşivlerden toplayacağı (gazete kupürleri, tarihi belgeler) ham malzemeler için ayrılmış boş kütüphane rafıdır. Dışarıdan akademik literatür barındırmaz. Bu kutunun subBoxes dizisi boş ([]) olarak üretilir. Master box concepts alanı boş bırakılır.

KUTU TİPİ 4 — DATA_PROTOCOL (Metodoloji ve Yöntem):
- Çalışmada kullanılan yöntemi (Nitel, Nicel, Karma, Arşiv vb.) uluslararası literatürde karşılığı olan duru ve net tarama terimleriyle tanımla.
- MUTLAK AMPİRİK YASAK (SIFIR TOLERANS): Bu kutunun subBoxes içindeki semanticQuery alanları SADECE yöntemsel, epistemolojik ve metodolojik literatürü tarayacak soyut cümlelerden oluşmalıdır. Araştırılan konuya, aktörlere, örgütlere veya döneme ait hiçbir ampirik ibare ("Kurdish", "socialist left" vb.) sorgulara dahil edilemez. Sorgular doğrudan nitel/söylemsel içerik analizi literatürünün kurucularını tetikleyecek yapıda olmalıdır.
- TEK YÖNTEM DURUMU: Tek bir bütünsel yöntem varsa, tüm nüansları tek bir subBox'ta birleştir. Yapay alt kırılım üretme. Master box'ın concepts alanına yönteme ait 2-4 Türkçe anahtar kavram ekle; subBox concepts içermez. SubBox'ın foundationalQueries alanına yöntemin 1-2 kurucu metodolojik klasiğini ekle.

# ANAHTAR KAVRAMLAR İÇİN SIKI KAPSAMLANDIRMA (STRICT SCOPING)
Master box'ın concepts dizisi serbest bir çağrışım alanı değildir. Kavramlar kesinlikle ve yalnızca o master box'ın kendi title veya description alanında geçen kelimelerden türetilmelidir. Sub-box'lar concepts alanı içermez.

# KURUCU ESER (FOUNDATIONAL QUERIES) KATI LİMİT KURALI
Her subBox'ın foundationalQueries alanına EN FAZLA 2 kurucu klasik eser eklenebilir. SADECE o literatürün asıl kurucu başyapıtları (Örn: Gramsci → Prison Notebooks; Snow & Benford → Frame Alignment; Foucault → Discipline and Punish; Krippendorff → Content Analysis) eklenir. Genel kaynakça, ikincil literatür veya çağdaş makaleler bu alana KESİNLİKLE EKLENMEZ.

# OPERASYONEL İLKELER VE DİL KURALLARI
1. DİL DENGESİ (SIFIR TOLERANS): Master box'ların title, description ve concepts alanları ile subBox'ların title alanları KESİNLİKLE TÜRKÇE akademik dille üretilmelidir. (Örn: "Antonio Gramsci'nin Hegemonya ve Mevzi Savaşı Kuramı"). subBoxes içindeki semanticQuery alanları KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir. foundationalQueries içindeki author ve title alanları orijinal dilinde (İngilizce) yazılmalıdır.
2. FORMAT: Master box seviyesinde concepts alanı bulunur; subBox'lar concepts alanı içermez (boş array olarak gelir). foundationalQueries yalnızca subBox'ların içinde yer alır. Yanıt, sağlanan JSON şemasına tamamen uygun ham bir JSON nesnesi olmalıdır. Do not add extra fields.

# FEW-SHOT ÖRNEKLERİ

## Örnek 1 — Karmaşık / Çoklu Odak (CONCEPTUAL — zorunlu bölünme)

Girdi matrisi:
<ornek_girdi_matrisi>
{
  "studyTitle": "Neoliberalizmde Siyasal İktidar İlişkisi Olarak Bireysel Borçlandırma: Türkiye'de Borçlu Öznelerin Pratikleri ve Söylemleri Üzerine Mikro-Düzey Bir Analiz",
  "theoreticalFramework": "Foucaulcu iktidar analizi ve yönetimsellik eleştirisi, Marksist sınıf ve yeniden üretim eleştirisi."
}
</ornek_girdi_matrisi>

Beklenen çıktı (concepts master box'ta, subBox'larda concepts yok):
<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "Neoliberal Yönetimsellik, İktidar ve Özne Teorisi",
      "boxType": "CONCEPTUAL",
      "description": "Foucaulcu iktidar analizi, yönetimsellik ve Marksist yeniden üretim eleştirisinin neoliberal borçluluk ve süreç olarak özne inşası bağlamındaki evrensel kuramsal temelleri.",
      "concepts": ["Yönetimsellik", "İktidar", "Biyoiktidar", "Özneleşme", "Yeniden Üretim", "Sermaye Birikimi"],
      "subBoxes": [
        {
          "title": "Foucault ve Yönetimsellik Kuramı",
          "semanticQuery": "This study draws on Michel Foucault's governmentality framework and biopolitical critique to analyze how modern power mechanisms operate through the conduct of conduct, shifting the focus toward decentralized networks of discipline and contemporary subjectivity.",
          "foundationalQueries": [
            { "author": "Michel Foucault", "title": "Discipline and Punish: The Birth of the Prison", "publicationYear": 1975 },
            { "author": "Michel Foucault", "title": "The History of Sexuality, Vol. 1: An Introduction", "publicationYear": 1976 }
          ]
        },
        {
          "title": "Marksist Yeniden Üretim ve Borçlandırma Eleştirisi",
          "semanticQuery": "This analytical framework integrates Karl Marx's social reproduction theory and capitalist accumulation critique to explore how financial mechanisms extract economic value directly from modern labor power and everyday social reproduction.",
          "foundationalQueries": [
            { "author": "Karl Marx", "title": "Capital: A Critique of Political Economy, Vol. 1", "publicationYear": 1867 }
          ]
        }
      ]
    }
  ]
}
</ornek_beklenen_cikti>

## Örnek 2 — Basit / Tekil Odak (DATA_PROTOCOL — bölünme gerekmez)

Girdi matrisi:
<ornek_girdi_matrisi>
{
  "studyTitle": "Türkiye'de Çerçeveleme Stratejilerinin Dönüşümü",
  "methodology": "Nitel içerik analizi ve eleştirel söylem analizi."
}
</ornek_girdi_matrisi>

Beklenen çıktı (tek yöntem, tek subBox; concepts master box'ta):
<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "Nitel İçerik ve Söylem Analizi Yöntemi",
      "boxType": "DATA_PROTOCOL",
      "description": "Çalışmada kullanılan nitel içerik analizi ve eleştirel söylem analizi yöntemlerinin epistemolojik temelleri ve uygulama protokolleri.",
      "concepts": ["Nitel İçerik Analizi", "Eleştirel Söylem Analizi"],
      "subBoxes": [
        {
          "title": "Nitel İçerik ve Söylem Analizi Protokolü",
          "semanticQuery": "This study employs qualitative content analysis and critical discourse analysis to systematically examine textual data, focusing on framing strategies, linguistic structures, and discursive power relations within the selected corpus.",
          "foundationalQueries": [
            { "author": "Klaus Krippendorff", "title": "Content Analysis: An Introduction to Its Methodology", "publicationYear": 1980 },
            { "author": "Norman Fairclough", "title": "Critical Discourse Analysis: The Critical Study of Language", "publicationYear": 1995 }
          ]
        }
      ]
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
  researchScope: string;
}): string {
  const matrixJson = JSON.stringify(params, null, 2);

  return `START_THESIS_MATRIX
${matrixJson}
END_THESIS_MATRIX

# GÖREV VE TALİMAT
Sistem talimatında tanımlanan esnek ontolojik kutu mimarisine, dil dengesine, DOĞAL EKSEN KURALI, SUBBOX MİMARİSİ VE MUTLAK İZOLASYON İLKESİ, MASTER BOX KURALI ve ANAHTAR KAVRAMLAR İÇİN TR SIKI KAPSAMLANDIRMA ilkelerine tam olarak bağlı kalarak yukarıdaki 6 boyutlu matris yapısını analiz et.

1. **Master Box Kuralı — concepts PARENT BOX SEVİYESİNDE, foundationalQueries SADECE subBox'ta:** Üst seviye kutularda (parentId=null) concepts alanı bulunur; bu alan tüm alt subBox'ların ortak temasını yansıtan 2-6 Türkçe anahtar kavram içerir. Sub-box'lar KESİNLİKLE concepts alanı içermez (boş array). Kurucu eserler (foundationalQueries) yalnızca subBox'ların içinde, en fazla 2 kurucu klasik eser olarak yer alır.

2. **Kapsayıcı ve Kurucu Odaklı Sorgular (SUBBOX İZOLASYON Sınırları):** subBoxes içindeki semanticQuery alanlarında saf anahtar kelime listeleri yerine akademik abstract formatında zengin paragraflar üret. 
   - CONCEPTUAL kutunun altındaki bağımsız subBox'ları oluştururken, matristeki teorilerin uluslararası literatürdeki evrensel ana kurucu isimlerini ve teknik patentli kavramlarını (Örn: "Gramsci", "hegemony", "war of position", "David Snow", "Robert Benford", "collective action frames", "frame alignment") paragrafların içine doğrudan, ismen ve kurumsal olarak dahil et. Bu subBox'ların foundationalQueries alanına o teorinin en temel 1-2 kurucu başyapıtını ekle.
   - CONCEPTUAL ve DATA_PROTOCOL kutularının subBox'larının semanticQuery alanlarına tezin yerel/ampirik unsurlarını (Örn: Kürt hareketi, Türkiye solu, 1991-1999) SIZDIRMA; bu alanları tamamen saf kuramsal ve yöntemsel düzeyde izole tut. Ampirik özneleri yalnızca PROBLEMATIZATION kutusunun subBox'larının semanticQuery alanlarına dahil et.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
