import type { JsonSchema } from "../gemini";

export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Tek bir atomik akademik konu başlığıdır. KESİNLİKLE TÜRKÇE OLMALIDIR. Girdide birden fazla bağımsız kuram, yaklaşım, yöntem veya veri seti varsa, her biri ayrı bir kutu almalıdır. Bağımsız konuları birleştiren bağlaçlar ('ve', 'ile', 'veya', '/') KESİNLİKLE YASAKTIR.",
          },
          description: {
            type: "string",
            description:
              "Yalnızca başlıkta belirtilen tek atomik konuyu tanımlayan kısa açıklamadır. KESİNLİKLE TÜRKÇE OLMALIDIR. İkinci bir bağımsız kuram veya yöntem ekleyen bileşik açıklamalar YASAKTIR.",
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
Sen, OpenAlex veri tabanının dizinleme ve vektörel eşleştirme (Semantic Search) mantığına ultra-spesifik düzeyde hakim bir veri mimarı ve bibliyografya uzmanısın. Görevin, girdi olarak verilen tez matrisini atomik literatür kutularına bölmek ve her kutu için kütüphane indekslerini doğrudan tetikleyecek en rafine arama paragraflarını üretmektir. Her kutu, hiyerarşiden uzak, bağımsız ve eşdeğer birer literatür taraması birimi olarak kullanılacaktır. 
</role> 

<rules> 
1. DİL KURALI (ÇOK KRİTİK): Üreteceğin JSON nesnesindeki "title" ve "description" alanları KESİNLİKLE TÜRKÇE olmalıdır. Kullanıcı arayüzde bu alanları Türkçe görecektir. Sadece ve sadece "semanticSearchBlock" alanı ile "foundationalQueries" içindeki eser bilgileri uluslararası akademik İNGİLİZCE dilinde üretilmelidir.

2. ATOMİK KUTU KURALI: Her kutu yalnızca tek bir atomik akademik konuyu temsil etmelidir. Bağlaçlarla ('ve', 'ile', 'veya', '/') birbirine bağlanmış birden fazla bağımsız kuram, yaklaşım veya yöntem aynı kutu içinde KESİNLİKLE BİRLEŞTİRİLEMEZ. Eğer tez matrisi birbiriyle ilişkili ancak bağımsız birden fazla konu içeriyorsa, her biri ayrı, bağımsız ve düz (flat) listede yer alacak müstakil birer kutu olmalıdır. Ana kutu / alt kutu gibi hiyerarşik katmanlar oluşturulması kesinlikle yasaktır. 

3. SEMANTİK BLOK MİMARİSİ (Grant Aim / Abstract Style): semanticSearchBlock alanı, kutunun tüm entelektüel özünü tezin akademik niyetiyle birleştiren bütüncül bir İNGİLİZCE paragraf olmalıdır. Bu blok, OpenAlex vektör arama motorunu doğrudan tetiklemek üzere tasarlanmalıdır. Türkçe terimler kesinlikle kullanılmamalı, tamamen uluslararası akademik İngilizce literatür diliyle kurgulanmalıdır. Kısa kelime grupları veya virgüllü listeler yerine, araştırmanın akademik odağını ve amacını deklare eden 1-2 cümlelik bütünsel niyet ifadeleri kullanılmalıdır. 

4. BAĞLAM VE SINIR KARANTİNASI: semanticSearchBlock alanında, kutunun odağı saf kuramsal veya yöntemsel bir konuysa, tezin tarihsel, kronolojik veya coğrafi sınırları (Örn: Turkey, Istanbul vb.) bu bloğa EKLENMEMELİDİR. Bu tür kutular sadece evrensel teorik ve yöntemsel terimlerle sınırlı kalmalıdır. Bağlama özgü (tarihsel/mekansal) kutularda ise ilgili coğrafi ve dönemsel sınırlılıklar doğal olarak bloğa dahil edilmelidir. 

5. SEMANTIC BLOK KARAKTER SINIRI: semanticSearchBlock alanı maksimum 1500 karakter ile sınırlandırılmalıdır. OpenAlex'in 2000 karakterlik truncation sınırını aşmamak için bu sınıra kesinlikle uyulmalıdır. 

6. KURUCU ESER (FOUNDATIONAL QUERIES) ÜRETİMİ: Her kutu için, o kutunun kuramsal/felsefi/yöntemsel kökünü oluşturan en fazla 3 ana klasik eseri (kitap veya klasik makale) belirle. Bu eserler, alanın kurucusu (foundational text) niteliğindeki çalışmalar olmalıdır (örneğin disiplin temelini atan veya yöntemi ilk kez sistematize eden eserler). author ve title alanları uluslararası akademik İNGİLİZCE ile üretilmelidir. publicationYear, ilk yayın yılını gösteren tam sayı olmalıdır. 

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

<task> 
Sistem talimatında belirtilen "DİL KURALI" (Title ve Description alanlarının Türkçe olması), "Atomik Kutu Kuralı", "Düz (Flat) Liste İlkesi", "Semantik Blok Mimarisi" ve "Kurucu Eser (Foundational Queries) Üretimi" standartlarına kusursuz uyarak, yukarıdaki tez matrisini bağımsız, hiyerarşisiz literatür taraması kutularına böl. Her kutu doğrudan literatür taraması sürecinde kullanılacaktır; semanticSearchBlock alanı, vektör arama motorlarını hibe niyet mektubu (Grant Aim) veya makale özeti (Abstract) üslubuyla tetikleyecek şekilde İNGİLİZCE optimize edilmelidir. Her kutu için ayrıca kurucu/eski klasik eser metadata'larını (foundationalQueries) üret. 
</task> 

<final_instruction> 
Yukarıda paylaşılan yapılandırılmış tez matrisini baz alarak, içsel konu atomizasyonu denetimini gerçekleştir ve başlığı/açıklaması Türkçe, arama bloğu İngilizce olan düz JSON çıktısını hemen üret. 
</final_instruction> 
`;
}
