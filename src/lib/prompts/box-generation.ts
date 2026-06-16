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
              "Tek bir atomik akademik konu başlığıdır. Girdide birden fazla bağımsız kuram, yaklaşım, yöntem veya veri seti varsa, her biri ayrı bir kutu almalıdır. Bağımsız konuları birleştiren bağlaçlar ('ve', 'ile', 'veya', '/') KESİNLİKLE YASAKTIR.",
          },
          description: {
            type: "string",
            description:
              "Yalnızca başlıkta belirtilen tek atomik konuyu tanımlamalıdır. İkinci bir bağımsız kuram veya yöntem ekleyen bileşik açıklamalar YASAKTIR.",
          },
          semanticSearchBlock: {
            type: "string",
            description:
              "Kutunun kuramsal çerçevesini, temel kavramlarını ve bağlamını içeren, OpenAlex vektör motorunu doğrudan tetikleyecek, elit bir akademik İngilizce ile yazılmış, en az 1-2 cümleden oluşan zengin anlamsal arama paragrafı. Bu blok, literatür taramasının ana motorudur. Sorgu, hibe/fon niyet mektubu (Grant Aim) veya makale özeti (Abstract) üslubuyla, niyeti ve anlamsal odağı belirten bütüncül bir akademik paragraf tarzında olmalı; asla virgülle ayrılmış kelime yığınları içermemelidir. Vektör benzerliğiyle doğru akademik makaleleri bulmak için optimize edilmelidir.",
          },
        },
        required: ["title", "description", "semanticSearchBlock"],
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
1. ATOMİK KUTU KURALI: Her kutu yalnızca tek bir atomik akademik konuyu temsil etmelidir. Bağlaçlarla ('ve', 'ile', 'veya', '/') birbirine bağlanmış birden fazla bağımsız kuram, yaklaşım veya yöntem aynı kutu içinde KESİNLİKLE BİRLEŞTİRİLEMEZ. Eğer tez matrisi birbiriyle ilişkili ancak bağımsız birden fazla konu içeriyorsa, her biri ayrı, bağımsız ve düz (flat) listede yer alacak müstakil birer kutu olmalıdır. Ana kutu / alt kutu gibi hiyerarşik katmanlar oluşturulması kesinlikle yasaktır.

2. SEMANTİK BLOK MİMARİSİ (Grant Aim / Abstract Style): semanticSearchBlock alanı, kutunun tüm entelektüel özünü tezin akademik niyetiyle birleştiren bütüncül bir İngilizce paragraf olmalıdır. Bu blok, OpenAlex vektör arama motorunu doğrudan tetiklemek üzere tasarlanmalıdır. Türkçe terimler kesinlikle kullanılmamalı, tamamen uluslararası akademik İngilizce literatür diliyle kurgulanmalıdır. Kısa kelime grupları veya virgüllü listeler yerine, araştırmanın akademik odağını ve amacını deklare eden 1-2 cümlelik bütünsel niyet ifadeleri kullanılmalıdır.

3. BAĞLAM VE SINIR KARANTİNASI: semanticSearchBlock alanında, kutunun odağı saf kuramsal veya yöntemsel bir konuysa, tezin tarihsel, kronolojik veya coğrafi sınırları (Örn: Turkey, Istanbul vb.) bu bloğa EKLENMEMELİDİR. Bu tür kutular sadece evrensel teorik ve yöntemsel terimlerle sınırlı kalmalıdır. Bağlama özgü (tarihsel/mekansal) kutularda ise ilgili coğrafi ve dönemsel sınırlılıklar doğal olarak bloğa dahil edilmelidir.

4. CONSTRAINTS:
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
Sistem talimatında belirtilen "Atomik Kutu Kuralı", "Düz (Flat) Liste İlkesi" ve "Semantik Blok Mimarisi" standartlarına kusursuz uyarak, yukarıdaki tez matrisini bağımsız, hiyerarşisiz literatür taraması kutularına böl. Her kutu doğrudan literatür taraması sürecinde kullanılacaktır; semanticSearchBlock alanı, vektör arama motorlarını hibe niyet mektubu (Grant Aim) veya makale özeti (Abstract) üslubuyla tetikleyecek şekilde optimize edilmelidir.
</task>

<final_instruction>
Based on the structured thesis matrix provided above, execute your internal query atomicity audit and generate the flat JSON response now.
</final_instruction>
`;
}
