import type { JsonSchema } from "../gemini";

export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "intro",
              "theory",
              "methodology",
              "context",
              "primary_source",
            ],
          },
          title: {
            type: "string",
            description:
              "Tek bir atomik akademik konu olmalıdır. Girdide birden fazla bağımsız kuram, yaklaşım, yöntem veya veri seti varsa, her biri ayrı bir kutu almalıdır. Bağımsız konuları birleştiren bağlaçlar ('ve', 'ile', 'veya', '/') KESİNLİKLE YASAKTIR.",
          },
          description: {
            type: "string",
            description:
              "Yalnızca başlıkta belirtilen tek atomik konuyu tanımlamalıdır. İkinci bir bağımsız kuram veya yöntem ekleyen bileşik açıklamalar YASAKTIR.",
          },
          theorists: {
            type: "array",
            items: { type: "string" },
            description:
              "Kutuya ait spesifik teorisyen listesi. Maksimum 2 isim.",
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 5,
          },
          queries: {
            type: "array",
            items: { type: "string" },
            minItems: 6,
            maxItems: 6,
            description:
              "STRICTLY FORBIDDEN to create sentences or long phrases. Each query MUST contain exactly 2 or 3 essential academic keywords joined by spaces. No stop-words, no verbs, no junk text. Must consist of 3 consecutive symmetric TR+EN twin pairs (Total length 6).",
          },
        },
        required: [
          "category",
          "title",
          "description",
          "theorists",
          "concepts",
          "queries",
        ],
      },
    },
  },
  required: ["boxes"],
};

export const THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION = `
<role>
Sen, akademik veri tabanlarının (Semantic Scholar, OpenAlex) dizinleme ve vektörel eşleştirme (Semantic Search) mantığına ultra-spesifik düzeyde hakim bir veri mimarı ve bibliyografya uzmanısın. Görevin, girdi olarak verilen tez matrisini atomik literatür kutularına bölmek ve her kutu için kütüphane indekslerini doğrudan tetikleyecek en rafine arama kelimelerini üretmektir.
</role>

<rules>
1. CATEGORY DISTRIBUTION: 5 ana kategori eksiksiz doldurulmalıdır — "intro", "theory", "methodology", "context", "primary_source".

2. SAF KEYWORD KURABI (EXACTLY 2-3 WORDS) - [EN KRİTİK KURAL]:
   - 'queries' dizisindeki her bir eleman, bir cümle, makale başlığı, soru kalıbı veya ağdalı kompozisyon ifadesi KESİNLİKLE OLAMAZ.
   - Her bir sorgu, aralarında sadece boşluk olan, en fazla 2 veya 3 adet yalın, saf, katı akademik anahtar kelimeden (Keyword/Token) oluşmak zorundadır.
   - "analizi", "arasındaki dönüşüm", "yansımaları", "üzerine inceleme", "evaluation of", "dynamics of" gibi tüm gürültü ve dolgu kelimeleri KESİNLİKLE YASAKTIR.
   - Sorgular TAM 6 eleman (3 TR + 3 EN ardışık simetrik çift) olmalıdır.

   *Hatalı Cümlemsi Sorgu (KESİNLİKLE YASAKTIR):* "Sosyal hareketlerin söylemsel dönüşüm süreçlerinde teşhis tedavi ve güdüleyici çerçevelerin analizi"
   *Doğru Keskin cURL Sorgusu (ŞART):* "cerceveleme teorisi toplumsal" / "framing theory social" (Tam olarak cURL testindeki gibi en fazla 3 kelime!)

3. EVRENSEL "PRIMARY SOURCE" VE ARŞİV KURALI:
   - "primary_source" veya "context" kategorisinde, arama motorunun doğrudan o kaynağı masaya yatırmış literatürü bulabilmesi için, sorgunun ilk kelimesi incelenen arşivin/özenin/derginin kendi ÖZEL ADI olmalı, yanına ise en fazla 1-2 kelimelik odak kavram eklenmelidir.
   
   *Hatalı Cümlemsi Sorgu (YASAK):* "Özgürlük Dünyası dergisinin Türkiye sosyalist solu ve Kürt hareketi ilişkisi yayınları"
   *Doğru Keskin Sorgu (ŞART):* "ozgurkurk dunyasi kurt" / "gelenek dergisi sosyalist" / "hadep parti soylem"

4. KATEGORİ BAZLI SINIR KARANTİNASI:
   - "theory" (Kuramsal) ve "methodology" (Yöntem) kategorilerindeki sorgulara tezin tarihsel, kronolojik (Örn: 1991-1999, 90'lar) veya coğrafi sınırlarını EKLEMEK KESİNLİKLE YASAKTIR. Bu kutular sadece evrensel 2 ya da 3 kelimelik teorik terim birleşimlerinden ibaret olmalıdır.
   
   *Hatalı Teori Sorgusu (YASAK):* "1991-1999 arasi siyasal hareketlerde cerceveleme teorisi uygulamalari"
   *Doğru Teori Sorgusu (ŞART):* "cerceveleme teorisi toplumsal" / "framing theory social"

5. CONSTRAINTS: 
   - Şu anki yıl 2026'dır. Bilgi sınırın Ocak 2025'tir. JSON çıktısı dışında hiçbir açıklama, gürültü veya markdown dışı metin üretme.
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
Sistem talimatında belirtilen "Kategorik Dağılım" ve özellikle "2-3 Kelimelik Saf Keyword Kuralı" standartlarına kusursuz uyarak, yukarıdaki tez matrisini literatür taraması süreçlerini yönetmek üzere 5 ana kategoriye göre yapısal kutulara böl.
</task>

<final_instruction>
Based on the structured thesis matrix provided above, execute your internal query atomicity audit and generate the JSON response now.
</final_instruction>
`;
}
