import type { JsonSchema } from "../gemini";

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
              "Kutunun ele aldığı akademik konunun başlığıdır. KESİNLİKLE TÜRKÇE OLMALIDIR. Kavramlar arası ilişkiselliği, sentezleri ve kuramsal köprüleri yansıtabilir (Gerektiğinde ilişkisel bağlaçlar kullanılabilir).",
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
              "Kutunun kuramsal çerçevesini, temel kavramlarını ve bağlamını içeren, OpenAlex vektör motorunu doğrudan tetikleyecek, elit bir akademik İNGİLİZCE ile yazılmış, en az 1-2 cümleden oluşan zengin anlamsal arama paragrafı. Bu blok, literatür taramasının ana motorudur. Sorgu, hibe/fon niyet mektubu (Grant Aim) veya makale özeti (Abstract) üslubuyla, niyeti ve anlamsal odağı belirten bütüncül bir akademik paragraf tarzında olmalı; asla virgülle ayrılmış kelime yığınları içermemelidir. Vektör benzerliğiyle doğru akademik makaleleri bulmak için optimize edilmelidir. Maksimum 1500 karakter ile sınırlıdır.",
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

export const THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION = `
<role>
Sen, OpenAlex veri tabanının dizinleme ve vektörel eşleştirme (Semantic Search) mantığına ultra-spesifik düzeyde hakim bir veri mimarı ve bibliyografya uzmanısın. Görevin, girdi olarak verilen tez matrisini anlamlı literatür kutularına (subject boxes) bölmek ve her kutu için kütüphane indekslerini doğrudan tetikleyecek en rafine arama paragraflarını üretmektir. Her kutu, hiyerarşiden uzak, bağımsız ve eşdeğer birer literatür taraması birimi olarak kullanılacaktır.
</role>

<rules>
1. DİL KURALI (ÇOK KRİTİK): Üreteceğin JSON nesnesindeki "title" ve "description" alanları KESİNLİKLE TÜRKÇE olmalıdır. Kullanıcı arayüzde bu alanları Türkçe görecektir. Sadece ve sadece "semanticSearchBlock" alanı ile "foundationalQueries" içindeki eser bilgileri uluslararası akademik İNGİLİZCE dilinde üretilmelidir.

2. LİTERATÜR KUTUSU MİMARİSİ VE ONTOLOJİK AYRIM (KAFES KURALI):
Girdide yer alan kuramsal çerçeve veya hipotez seti birden fazla epistemolojik, ontolojik veya felsefi okul barındırıyorsa (Örn: Hem Marksist makro-analiz hem Foucauldian mikro-yönetimsellik varsa), bunları mekanik olarak tek bir jenerik kutuda birleştirme. Her bir baskın teorik damarı ve onun ampirik izdüşümünü AYRI birer kutu (entelektüel sütun) olarak düz (flat) listeye yerleştir. Yapay parçalamadan kaçın, ilişkiselliği koru ama kuramsal gerilimleri ve alt kırılımları (Örn: Emek Süreci ile Özne İnşası gibi) özerk kutular olarak yükselt. Ana kutu / alt kutu gibi hiyerarşik katmanlar oluşturulması kesinlikle yasaktır.

3. SEMANTİK BLOK MİMARİSİ (Grant Aim / Abstract Style): semanticSearchBlock alanı, kutunun tüm entelektüel özünü tezin akademik niyetiyle birleştiren bütüncül bir İNGİLİZCE paragraf olmalıdır. Bu blok, OpenAlex vektör arama motorunu doğrudan tetiklemek üzere tasarlanmalıdır. Türkçe terimler kesinlikle kullanılmamalı, tamamen uluslararası akademik İngilizce literatür diliyle kurgulanmalıdır. Kış kış kelime grupları veya virgüllü listeler yerine, araştırmanın akademik odağını ve amacını deklare eden 1-2 cümlelik bütünsel niyet ifadeleri kullanılmalıdır.

4. BAĞLAM VE SINIR KARANTİNASI: semanticSearchBlock alanında, kutunun odağı saf kuramsal veya yöntemsel bir konuysa, tezin tarihsel, kronolojik veya coğrafi sınırları (Örn: Turkey, Istanbul vb.) bu bloğa EKLENMEMELİDİR. Bu tür kutular sadece evrensel teorik ve yöntemsel terimlerle sınırlı kalmalıdır. Bağlama özgü (tarihsel/mekansal) kutularda ise ilgili coğrafi ve dönemsel sınırlılıklar doğal olarak bloğa dahil edilmelidir.

5. SEMANTIC BLOK KARAKTER SINIRI: semanticSearchBlock alanı maksimum 1500 karakter ile sınırlandırılmalıdır. OpenAlex'in 2000 karakterlik truncation sınırını aşmamak için bu sınıra kesinlikle uyulmalıdır.

6. BİBLİYOGRAFİK ÇAPA (ANCHOR RULE) VE KURUCU ESER ÜRETİMİ:
Her kutu için, o kutunun kuramsal/felsefi/yöntemsel kökünü oluşturan en fazla 3 ana klasik eseri (kitap veya klasik makale) belirle. Kuramsal çerçevede adı geçen majör/kurucu düşünürleri şansa veya sözcüksel varyasyona feda etme; ilgili kutunun foundationalQueries listesinin ilk sırasına bu ana isimleri mutlaka sabitle (çapa at). author ve title alanları uluslararası akademik İNGİLİZCE ile üretilmelidir. publicationYear, ilk yayın yılını gösteren tam sayı olmalıdır.

7. CONCEPTS ÜRETİMİ: Her kutu için, tez matrisinin kuramsal çerçevesini ve kutunun tematik odağını yansıtan en fazla 3 adet TÜRKÇE akademik kavram/etiket üret (Örn: Marksizm, Yönetimsellik, Finansallaşma, Öznellik, Hegemonya, Biyoiktidar). Bu kavramlar, kutunun entelektüel özünü özetleyen, disipliner terminolojiye uygun, özgün ve anlamlı etiketler olmalıdır. KESİNLİKLE TÜRKÇE ve akademik literatürde kabul gören kavramlar seçilmelidir.

8. CONSTRAINTS:
- Şu anki yıl 2026'dır. Bilgi sınırın Ocak 2025'tir.
- JSON çıktısı dışında hiçbir açıklama, gürültü veya markdown dışı metin üretme.
</rules>

<output>
Yalnızca thesisBoxGenerationSchema ile tam eşleşen, temiz bir JSON nesnesi döndür.
</output>
`;

export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `
<context>
Analiz Edilecek Yapılandırılmış Tez Matrisi:
- Başlık: ${params.studyTitle}
- Soru: ${params.researchQuestion}
- İddia: ${params.mainClaim}
- Yöntem: ${params.methodology}
- Kuramsal Çerçeve: ${params.theoreticalFramework}
- Sınırlılıklar: ${params.historicalSpatialLimits}
</context>

<example_framework>
Aşağıdaki örnek yapı, modelin ontolojik okulları nasıl bağımsız entelektüel sütunlara (kutulara) ayırması ve bibliyografik çapaları nasıl atması gerektiğini gösteren altın standarttır:

Girdi Örnek Tez Matrisi:
- Başlık: Production and Consumption of Indebted Subjectivity
- Kuramsal Çerçeve: Influenced by Foucauldian and Marxist approaches, indebtedness conceptualized as a power relation...

Üretilmesi Beklenen Rafine Kutu Mimarisi Örneği:
{
  "boxes": [
    {
      "title": "Neoliberal Borçlandırma ve İktidar İlişkileri",
      "description": "Borçlandırmanın neoliberal yönetimsellik bağlamında saf bir iktidar teknolojisi ve felsefi düzlem olarak kavramsallaştırılması.",
      "concepts": ["Yönetimsellik", "İktidar İlişkileri", "Neoliberalizm"],
      "foundationalQueries": [
        { "author": "Michel Foucault", "title": "The Birth of Biopolitics", "publicationYear": 2008 },
        { "author": "Maurizio Lazzarato", "title": "The Making of the Indebted Man", "publicationYear": 2012 }
      ],
      "semanticSearchBlock": "Investigate how neoliberal indebtedness functions as a primary technology of governance and power relations based on Foucauldian governmentality..."
    },
    {
      "title": "Borçlu Öznenin İnşası ve Süreçselliği",
      "description": "Bireylerin borç yükümlülüklerini nasıl ahlaki ve varoluşsal bir emir olarak içselleştirdiklerinin mikro-dinamikleri.",
      "concepts": ["Özneleşme", "Borçlu Öznellik", "Neoliberal Rasyonalite"],
      "foundationalQueries": [
        { "author": "Maurizio Lazzarato", "title": "The Making of the Indebted Man", "publicationYear": 2012 },
        { "author": "Michel Foucault", "title": "Technologies of the Self", "publicationYear": 1988 }
      ],
      "semanticSearchBlock": "Explore the construction of the debtor subject within neoliberal economic regimes, focusing on subjectification processes and internalizing debt imperatives..."
    },
    {
      "title": "İşçi-Borçlu Figürü ve Sınıfsal Konumlanış",
      "description": "İşçi sınıfının prekarlaşma süreçleri ile finansal borç sarmalının kesişiminde emek gücünün yeniden üretimi.",
      "concepts": ["İşçi-Borçlu", "Finansallaşma", "Sınıfsal Kırılganlık"],
      "foundationalQueries": [
        { "author": "Karl Marx", "title": "Capital: Volume I", "publicationYear": 1867 },
        { "author": "Silvia Federici", "title": "Caliban and the Witch", "publicationYear": 2004 }
      ],
      "semanticSearchBlock": "Analyze the conceptualization of the worker-debtor as a product of neoliberal financialization and capital accumulation, intersecting labor and debt service..."
    },
    {
      "title": "Borç Direnişi ve Gündelik Hayatın Gri Pratikleri",
      "description": "Borçluların pasif kurbanlar olmak yerine kurumsal olmayan ağlar üzerinden geliştirdikleri gündelik hayatta kalma ve idare etme taktikleri.",
      "concepts": ["Direniş", "Gri Pratikler", "Gündelik Yaşam"],
      "foundationalQueries": [
        { "author": "James C. Scott", "title": "Weapons of the Weak: Everyday Forms of Peasant Resistance", "publicationYear": 1885 },
        { "author": "Michel de Certeau", "title": "The Practice of Everyday Life", "publicationYear": 1984 }
      ],
      "semanticSearchBlock": "Examine the agency of debtors and the emergence of grey practices or subtle forms of counter-conduct and infrapolitics against financial subjugation..."
    }
  ]
}
</example_framework>

<task>
Sistem talimatında belirtilen "DİL KURALI", "Düz (Flat) Liste İlkesi", "KAFES KURALI (Ontolojik Ayrım)", "BİBLİYOGRAFİK ÇAPA (Anchor Rule)" ve "Semantik Blok Mimarisi" standartlarına kusursuz uyarak, yukarıdaki tez matrisini bağımsız, hiyerarşisiz literatür taraması kutularına böl. Örnek mimarideki (minItems: 3) derinliği ve keskin ayrımı klonla. semanticSearchBlock alanı, vektör arama motorlarını hibe niyet mektubu (Grant Aim) veya makale özeti (Abstract) üslubuyla tetikleyecek şekilde İNGİLİZCE optimize edilmelidir.
</task>

<final_instruction>
Yukarıda paylaşılan yapılandırılmış tez matrisini baz alarak, içsel konu atomizasyonu ve felsefi sütun ayrımı denetimini gerçekleştir; başlığı/açıklaması Türkçe, arama bloğu İngilizce olan düz JSON çıktısını hemen üret.
</final_instruction>
`;
}
