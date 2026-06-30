import type { JsonSchema } from "../gemini";

export interface RefereeCandidate {
  index: number;
  title: string;
  author: string;
  year: number;
  localCount: number;
}

export interface RefereeBoxContext {
  boxType: string;
  title: string;
  description: string;
}

export const CO_CITATION_REFEREE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    champion: {
      type: "object",
      properties: {
        title: { type: "string", description: "Eserin tam başlığı" },
        author: { type: "string", description: "Yazar adı" },
        publicationYear: {
          type: "number",
          description: "Orijinal yayın yılı",
        },
        academicReasoning: {
          type: "string",
          description: "Seçim gerekçesi — akademik Türkçe",
        },
      },
      required: ["title", "author", "publicationYear", "academicReasoning"],
    },
  },
  required: ["champion"],
};

export function buildRefereeSystemInstruction(): string {
  return (
    "Akademik atıf analizi ve kurucu klasik eser tespiti alanlarında uzman bir baş hakemsiniz (lead referee).\n\n" +
    "Göreviniz, ilgili konu kutusuna (mikro kutu) ait OpenAlex aday listesini inceleyerek, bu alanın asıl kurucu klasiği (root classic) olan temel eseri belirlemektir.\n\n" +
    "Kurallar:\n" +
    "1. Farklı edisyon/çeviri bölünmelerini tespit edin: Aynı eserin farklı veri tabanı kimliklerine dağılmış basım ve çevirilerini anlamsal olarak birleştirin.\n" +
    "2. İkincil literatürü eleyin: Yorumcuların veya üzerine yazılmış diğer akademik eserler değerli olsa da, bu mikro kutunun asıl kurucu klasiği konumunda değildir.\n" +
    "3. Kendi akademik ve entelektüel birikiminizi kullanın: Sunulan mikro kutu bağlamı açısından en uygun kurucu klasik metni tespit edin.\n\n" +
    'SADECE en güçlü ve kurucu nitelikteki tek (1) eseri "şampiyon" (champion) olarak seçin. Birden fazla eser belirlemeyin.'
  );
}

export function buildRefereePrompt(
  candidateList: RefereeCandidate[],
  boxContext?: RefereeBoxContext,
): string {
  const ctxLines = [
    `<mikro_kutu_baglami>`,
    `  Tür: ${boxContext?.boxType ?? "Bilinmiyor"}`,
    `  Başlık: ${boxContext?.title ?? "Bilinmiyor"}`,
    `  Açıklama: ${boxContext?.description ?? "Bilinmiyor"}`,
    `</mikro_kutu_baglami>`,
    ``,
    `<aday_listesi>`,
    ...candidateList.map(
      (c) =>
        `  Aday ${c.index}: "${c.title}" — ${c.author} (${c.year}) — OrtakAtifSayisi: ${c.localCount}`,
    ),
    `</aday_listesi>`,
    ``,
    `Yukarıda sunulan aday listesini titizlikle değerlendirin. Hangi eser bu mikro kutunun asıl kurucu klasiği olma niteliğini taşımaktadır?`,
  ];
  return ctxLines.join("\n");
}
