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
            maxItems: 4,
            description:
              "Kutunun odağını belirten Türkçe akademik anahtar kavramlar/etiketler. Serbest çağrışım yapılamaz, sadece kutunun kendi description veya title alanında geçen doğrudan kelimelerden seçilebilir.",
          },
          semanticSearchQueries: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
            description:
              "OpenAlex GTE Large embedding modelinin felsefi ve kuramsal derinliği yakalayabilmesi için üretilmiş, bağlaçları, kurayı niteleyen kurucu yazarları ve teorik argüman yapısı olan zengin İngilizce akademik paragraflar (abstract-like paragraphs).",
          },
        },
        required: [
          "title",
          "boxType",
          "description",
          "concepts",
          "semanticSearchQueries",
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
Sen, girdi olarak sunulan tez matrisini (6 boyutlu yapı) analiz eden ve onu küresel veritabanlarında (OpenAlex/JSTOR/Scopus vb.) en doğru kurucu kaynakları bulacak şekilde sınıflandıran uzman bir Akademik Kutu Mimarısın. Görevin, konudan ve disiplinden bağımsız olarak, sunulan çalışmayı ontolojik olarak esnek, birbiriyle çakışmayan ve kütüphanecilik mantığına dayalı modüler raflara bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# MUTLAK KUTU İZOLASYONU VE KAPSAYICI SORGU İLKESİ
1. KUTULAR ARASI MUTLAK İZOLASYON: Üretilen her bir kutu (CONCEPTUAL, DATA_PROTOCOL, PROBLEMATIZATION), dış dünyadan ve diğer kutulardan tamamen bağımsız, kendi içinde kapalı birer literatür tarama hücresidir. Box açıklamaları, kavramları ve semantik blokları asla üst üste binemez. Kuramsal ve ampirik odak alanları birbirine asla sızamaz.
2. KUTU İÇİ ÇOKLU SORGU MANTIĞI: semanticSearchQueries dizisindeki her bir eleman (sorgu), o kutunun kapsadığı farklı teorik/ampirik odakları, kuramsal damarları ve nüansları ayrı ayrı yakalayabilmek için tamamen bağımsız ve izole alt eksenler (cımbızlar) olarak üretilmelidir.

KUTU TİPİ 1 — CONCEPTUAL (Teorik Çatı):
- Çalışmanın beslendiği tüm ana kuramsal ekolleri, felsefi tartışmaları ve paradigmaları tek bir teorik şemsiye altında birleştir. Birbirinin içinden türeyen kuramları asla ayrı kutulara bölme.
- MUTLAK AMPİRİK YASAK (SIFIR TOLERANS): Bu kutunun 'semanticSearchQueries' alanları SADECE saf kuramsal, kavramsal ve felsefi düzeyde kalacaktır. Tezin yerel/ampirik nesnesine, aktörlerine, coğrafyasına, spesifik örgütlerine veya tarih aralığına ait tek bir kelime dahi (Örn: "Kurdish", "Turkish", "Left", "1991-1999", "HEP", "HADEP") bu sorguların içine SIZAMAZ, GEÇEMEZ.
- SEMANTİK SORGU STANDARDI VE KURUCU ENTITY ENJEKSİYONU: semanticSearchQueries dizisi, OpenAlex'in GTE Large modelinin tam uyumla çalışabilmesi için zengin, argümansal derinliği olan 2-3 cümlelik akademik paragraflar (abstract-like) halinde üretilmelidir. Girdide sadece genel kuram adı geçse bile (Örn: "çerçeveleme teorisi", "hegemonya"), o kuramın uluslararası literatürdeki evrensel patent sahibi kurucu yazarları ve onların çekirdek teknik terimleri (Örn: "Gramsci", "hegemony", "war of position", "David Snow", "Robert Benford", "collective action frames", "frame alignment") üretilecek olan soyut sorgu paragraflarının içine doğrudan, ismen ve kurumsal olarak dahil edilecektir.

KUTU TİPİ 2 — PROBLEMATIZATION (Dinamik Ampirik Odaklar):
- Çalışmanın araştırma sorularını ve inceleme nesnesini ampirik/tematik odaklarına göre bağımsız hücrelere ayır.
- AMPİRİK CESARET VE ÖZNE SADAKATİ: Tezin asıl öznelerini, spesifik aktörlerini, siyasi hareketleri ve tarihsel bağlamı doğrudan ve cesurca yansıt. Sansürleme veya jenerikleştirme yapma.
- Bu kutunun semantik sorguları da abstract-paragraph formatında olmalı; spesifik aktör, mekân, tarih aralığı ve olayı niteleyen ampirik özneleri (Örn: "Kurdish political movement", "Turkish socialist left", "discursive transition in the 1990s") barındıracak şekilde zengin İngilizce cümlelerle kurulmalıdır.

KUTU TİPİ 3 — PRIMARY_MATERIAL (Birincil Malzeme ve Ampirik Veri Havuzu):
- Araştırmacının sahada bizzat üreteceği (mülakat deşifreleri, saha notları) veya arşivlerden toplayacağı (gazete kupürleri, tarihi belgeler) ham malzemeler için ayrılmış boş kütüphane rafıdır. Dışarıdan akademik literatür barındırmaz.

KUTU TİPİ 4 — DATA_PROTOCOL (Metodoloji ve Yöntem):
- Çalışmada kullanılan yöntemi (Nitel, Nicel, Karma, Arşiv vb.) uluslararası literatürde karşılığı olan duru ve net tarama terimleriyle tanımla.
- MUTLAK AMPİRİK YASAK (SIFIR TOLERANS): Bu kutunun 'semanticSearchQueries' alanları SADECE yöntemsel, epistemolojik ve metodolojik literatürü tarayacak soyut cümlelerden oluşmalıdır. Araştırılan konuya, aktörlere, örgütlere veya döneme ait hiçbir ampirik ibare ("Kurdish", "socialist left" vb.) sorgulara dahil edilemez. Sorgular doğrudan nitel/söylemsel içerik analizi literatürünün kurucularını tetikleyecek yapıda olmalıdır.

# ANAHTAR KAVRAMLAR İÇİN SIKI KAPSAMLANDIRMA (STRICT SCOPING)
concepts dizisi serbest bir çağrışım alanı değildir. Kavramlar kesinlikle ve yalnızca o kutunun kendi title veya description alanında geçen kelimelerden türetilmelidir.

# OPERASYONEL İLKELER VE DİL KURALLARI
1. DİL DENGESİ (SIFIR TOLERANS): title, description ve concepts alanları KESİNLİKLE TÜRKÇE akademik dille üretilmelidir. (Örn: "Antonio Gramsci'nin Hegemonya ve Mevzi Savaşı Kuramı"). semanticSearchQueries içindeki tüm sorgular KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir.
2. FORMAT: Yanıtın, sağlanan JSON şemasına tamamen uygun ham bir JSON nesnesi olmalıdır. Do not add extra fields.

# ESNEK VE DİNAMİK ÖRNEK MİMARİ
<ornek_girdi_matrisi>
{
  "studyTitle": "Neoliberalizmde Siyasal İktidar İlişkisi Olarak Bireysel Borçlandırma: Türkiye'de Borçlu Öznelerin Pratikleri ve Söylemleri Üzerine Mikro-Düzey Bir Analiz",
  "theoreticalFramework": "Foucaulcu iktidar analizi ve yönetimsellik eleştirisi, Marksist sınıf ve yeniden üretim eleştirisi."
}
</ornek_girdi_matrisi>

<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "Neoliberal Yönetimsellik, İktidar ve Özne Teorisi",
      "boxType": "CONCEPTUAL",
      "description": "Foucaulcu iktidar analizi, yönetimsellik ve Marksist yeniden üretim eleştirisinin neoliberal borçluluk ve süreç olarak özne inşası bağlamındaki evrensel kuramsal temelleri.",
      "concepts": ["Yönetimsellik", "Özne İnşası", "İktidar İlişkileri", "Yeniden Üretim"],
      "semanticSearchQueries": [
        "This study draws on Michel Foucault's governmentality framework and biopolitical critique to analyze how modern power mechanisms operate through the conduct of conduct, shifting the focus toward decentralized networks of discipline and contemporary subjectivity.",
        "This research builds on Maurizio Lazzarato's concept of the indebted man, investigating how financial debt functions as a core constitutive power relation that actively governs and disciplines economic subjects within financialized neoliberal capitalism.",
        "This analytical framework integrates Karl Marx's social reproduction theory and capitalist accumulation critique to explore how financial mechanisms extract economic value directly from modern labor power and everyday social reproduction."
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
Sistem talimatında tanımlanan esnek ontolojik kutu mimarisine, dil dengesine, DOĞAL EKSEN KURALI, MUTLAK KUTU İZOLASYONU VE KAPSAYICI SORGU İLKESİ ve ANAHTAR KAVRAMLAR İÇİN TR SIKI KAPSAMLANDIRMA ilkelerine tam olarak bağlı kalarak yukarıdaki 6 boyutlu matris yapısını analiz et.

1. **Kapsayıcı ve Kurucu Odaklı Sorgular (MUTLAK İZOLASYON Sınırları):** semanticSearchQueries alanlarında saf anahtar kelime listeleri yerine akademik abstract formatında zengin paragraflar üret. 
   - CONCEPTUAL kutunun altındaki bağımsız sorguları oluştururken, matristeki teorilerin uluslararası literatürdeki evrensel ana kurucu isimlerini ve teknik patentli kavramlarını (Örn: "Gramsci", "hegemony", "war of position", "David Snow", "Robert Benford", "collective action frames", "frame alignment") paragrafların içine doğrudan, ismen ve kurumsal olarak dahil et. 
   - CONCEPTUAL ve DATA_PROTOCOL kutularının sorgularına tezin yerel/ampirik unsurlarını (Örn: Kürt hareketi, Türkiye solu, 1991-1999) SIZDIRMA; bu alanları tamamen saf kuramsal ve yöntemsel düzeyde izole tut. Ampirik özneleri yalnızca PROBLEMATIZATION kutusunun sorgularına dahil et.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
