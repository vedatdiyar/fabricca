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
    "Sen, akademik atıf analizi ve klasik eser tespiti konusunda uzman bir baş denetçisin (lead referee).\n\n" +
    "Görevin, bir mikro kutuya ait OpenAlex aday listesini inceleyip hangi eserin asıl kurucu klasik (root classic) olduğunu belirlemektir.\n\n" +
    "Kurallar:\n" +
    "1. Farklı edisyon/çeviri parçalanmalarını tespit et: Aynı eserin farklı OpenAlex ID'lerine dağılmış baskılarını anlamsal olarak birleştir.\n" +
    "2. Sekonder literatürü ele: Yorumcuların eserleri değerli olsa da, bu mikro kutunun asıl kurucu klasiği değildir.\n" +
    "3. Kendi akademik bilgini kullan: Bu mikro kutu bağlamında en uygun kurucu metni belirle.\n\n" +
    "SADECE en güçlü 1 adet eseri şampiyon olarak seç. Birden fazla eser seçme."
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
    `Yukarıdaki aday listesini değerlendir. Hangi eser, bu mikro kutunun asıl kurucu klasiğidir?`,
  ];
  return ctxLines.join("\n");
}
