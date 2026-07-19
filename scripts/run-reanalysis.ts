import { config } from "dotenv";
config({ path: ".env.local" });

import * as cheerio from "cheerio";
import { createConcurrencyLimiter } from "../src/lib/rate-limiter";
import type { Logger } from "../src/lib/logger";
import type { TezaraThesisDetails } from "../src/lib/types";
import { analyzeOriginalityRisk } from "../src/app/(onboarding)/onboarding/risk/_services/analysis";

const TEZARA_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  connection: "keep-alive",
};

const THESIS_IDS = [
  187063, 204721, 217783, 288057, 363401, 393408, 396084, 397497, 401246,
  447567, 451561, 487378, 496006, 537669, 579932, 621752, 636301, 668446,
  731883, 738683,
];

const THESIS_METADATA: Record<number, { title: string; author: string }> = {
  187063: {
    title:
      "1980'den sonra Türkiye'de sosyalist partilerin siyaset anlayışı / Way of making politics at socialist parties in Turkey after 1980",
    author: "ATİKE ZEYNEP KILIÇ",
  },
  204721: {
    title:
      "Turkish modernity and Kurdish ethno-nationalism / Türk modernliği ve Kürt etnik milliyetçiliği",
    author: "MEKİN MUSTAFA KEMAL ÖKEM",
  },
  217783: {
    title:
      "Representation of the Kurdish question in Hurriyet and Cumhuriyet (1990-2006) / Kürt meselesinin Hürriyet ve Cumhuriyet'te temsili (1990-2006)",
    author: "ÖZGE BAYINDIR",
  },
  288057: {
    title:
      "The politicization of Kurdish nationalism / Kürt milliyetçiliğinin siyasallaşması",
    author: "GÜLAYŞE ÜLGEN",
  },
  363401: {
    title:
      "1990-2014 dönemi Kürt siyasal hareketinin söyleminin dönüşümü / Transformation of Kurdish political movement discourse during 1990-2014",
    author: "KADRİYE OKUDAN DERNEK",
  },
  393408: {
    title:
      "Türkiye'deki kürt siyasal hareketinde sivil itaatsizlik / Civil disobedience in kurdish political movement in Turkey",
    author: "SEYHAN ATAK",
  },
  396084: {
    title:
      "Siyasal alanda erkekliğin inşası: Kürt siyasi hareketinde cinsiyetin yeniden konumlanışı / Construction of masculinity in the political sphere: Re - positioning of gender in Kurdish political movement",
    author: "BAHAR MERMERTAŞ",
  },
  397497: {
    title:
      "The discourse of the justice and development party on the Kurdish and minority issues / Adalet ve Kalkınma Partisinin Kürt ve azınlık konusunda söylemi",
    author: "İRFAN KEŞOĞLU",
  },
  401246: {
    title:
      "The perception between the Pro-Islamic and Pro-Kurdish political streams in Turkey, 1980-2011 / Başlık çevirisi yok",
    author: "RAHMAN DAĞ",
  },
  447567: {
    title:
      "Kürt siyasal hareketinde İslami bir aktör: Irak Kürdistan İslami Birlik Partisi / An islamic actor in Kurdish political movement: Iraqi Kurdistan Party of İslamic Union",
    author: "LOKMAN KARADAĞ",
  },
  451561: {
    title:
      "Yerel siyaset ve kentleşme bağlamında Diyarbakır örneği / Local politics and urbanization: Diyarbakır case",
    author: "SUNA YILMAZ AÇIKEL",
  },
  487378: {
    title:
      "The Kurdish ethnoregional movement in Turkey: From class to nation (1959-1974) and from nation to 'revolution' (1974-1984) / Türkiye'de Kürt etno-bölgesel hareketi: Sınıftan millete (1959-1974), milletten 'devrime' (1974-1984)",
    author: "AHMET ALIŞ",
  },
  496006: {
    title:
      "CHP's discourse on the Kurdish Question: Continuties or ruptures / CHP söyleminde Kürt Sorunu: Süreklilik mi kopuş mu?",
    author: "ONUR ALP YILMAZ",
  },
  537669: {
    title:
      "Türkiye sosyalist solunun Kürt meselesine bakışı: 1960-1971 / Perspective of Turkish socialist left to the Kurdish issue: 1960-1971",
    author: "ENES ATEŞ",
  },
  579932: {
    title:
      "Parti, cami, cemevi: Kürt siyasal hareketinin dinle kurduğu dönüştürücü ilişki / Party, mosque, cemevi: Kurdish political movement's transformative relationship with religion",
    author: "ERKAN KARABAY",
  },
  621752: {
    title:
      "Küreselleşme sürecinde Türkiye'de siyasal değişmenin yerel temelleri: Diyarbakır'da kentleşme ve siyasal değişme ilişkisi örneği / Local bases of political change in Turkey during the globalization process: The case of relationship between urbanization and political change in Diyarbakir",
    author: "HAKAN GÜZELSOY",
  },
  636301: {
    title:
      "Türkiye'de sol hareketlerin evrimi ve başarısızlık nedenleri / Evolution of the left movement in Turkey and the rationale for failure",
    author: "MERTCAN YILMAZ",
  },
  668446: {
    title:
      "Kürt sekülerleşmesi: Kuşak farklılaşması bağlamında Diyarbakır'da dini değişim / Kurdish secularization: Religious change in Diyarbakır in the context of generational differentiation",
    author: "YUSUF EKİNCİ",
  },
  731883: {
    title:
      "Kürtlerde aidiyet, kimlik ve milliyetçilik: Batman örneği / Belonging to the Kurds, identity and nationalism: The case of Batman",
    author: "MERT EREKMEKÇİ",
  },
  738683: {
    title:
      "'Devlet aklı' ve Türkiye'de Kürt sorununun politik algılanışı / 'Reason of state' and the political perception of the Kurdish question in Turkey",
    author: "TURHAN KARA",
  },
};

const MATRIX = {
  mainActors:
    "Kürt Siyasi Hareketi (PKK/Serxwebûn çizgisi, DEP ve HADEP) ile Türkiye Sosyalist Hareketi (Gelenek/STP/SİP çizgisi, Özgürlük Dünyası/Evrensel/ EMEP çizgisi, Sosyalist İşçi Partisi, DSİP).",
  researchFocus:
    "Kürt siyasi hareketinin söylemsel ve paradigmal dönüşümünün literatürde genellikle 1999 sonrasına indirgenmesi ve Türkiye sosyalist hareketiyle olan hegemonya ilişkisinin bu söylemsel dönüşüm bağlamında yeterince incelenmemiş olması; 1990'larda Kürt siyasi hareketinin Marksist-Leninist siyasal söyleminin nasıl çerçevelendiği ve bu dönüşümün Türkiye sosyalist hareketiyle kurduğu ilişkiyi nasıl etkilediği.",
  context:
    "1991–1999 yılları arası Türkiye (ve Avrupa tabanlı yayın ağları). Küresel reel sosyalizmin krizi, Türkiye'deki 90'lar siyasi iklimi, Kürt toplumundaki yoğun kentleşme ve zorunlu göç dalgaları ile legal siyaset alanının ortaya çıkışı.",
  theoreticalFramework:
    "Snow ve Benford'un Çerçeveleme Teorisi (Kürt hareketinin iç söylem boyutu ve kavramsal dönüşümlerini) ile Antonio Gramsci'nin Hegemonya Yaklaşımı (iki hareket arasındaki ilişkisel boyutu, rıza mücadelesini ve tersine dönen hegemonik güç dengesini açıklamak için).",
  methodology:
    "Niteliksel söylem analizi. Veri kaynakları olarak Kürt hareketi cephesinden Serxwebûn, Özgür Gündem ve ardılı gazeteler ile DEP/ HADEP parti belgeleri; Türkiye sosyalist hareketi cephesinden Gelenek, Özgürlük Dünyası, Evrensel ve ilgili sosyalist partilerin (STP, SİP, EMEP vb.) program, tüzük ve bildirileri.",
  mainClaim:
    "Kürt siyasi hareketinin 1990'lardaki söylem dönüşümü, Marksist-Leninist ideolojiden ani bir kopuş değil, değişen küresel/yerel koşullara adaptasyon amacıyla gerçekleştirilen bir yeniden çerçeveleme sürecidir; 1999 yılı bu dönüşümün miladı değil, 90'lar boyunca olgunlaşan sürecin kurumsallaşma eşiğidir. Bu dönüşüm, 1980 sonrasında Kürt hareketinin lehine tersine dönen hegemonya ilişkisinin Türkiye sosyalist hareketiyle kurulan bağlardaki söylemsel yansımasıdır.",
};

async function fetchThesisAbstract(
  id: number,
): Promise<string | null> {
  try {
    const url = `https://tezara.org/theses/${id}`;
    const response = await fetch(url, { headers: TEZARA_HEADERS });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    const abstractEl = $("#abstract");
    let abstract = abstractEl.text().trim();
    if (!abstract || abstract.length < 10 || /^Özet yok\.?$/i.test(abstract)) {
      const translatedEl = $("#abstract_translated");
      abstract = translatedEl.text().trim();
    }
    return abstract && abstract.length >= 10 ? abstract : null;
  } catch {
    return null;
  }
}

async function fetchAllThesisDetails(): Promise<TezaraThesisDetails[]> {
  const limiter = createConcurrencyLimiter(12);
  const results: TezaraThesisDetails[] = [];

  const promises = THESIS_IDS.map((id) =>
    limiter.exec(async () => {
      const meta = THESIS_METADATA[id];
      const abstract = await fetchThesisAbstract(id);
      if (abstract) {
        results.push({
          id,
          title: meta.title,
          author: meta.author,
          university: "",
          year: 0,
          thesisType: "",
          department: "",
          abstract,
        });
      }
    }),
  );

  await Promise.all(promises);
  results.sort((a, b) => a.id - b.id);
  return results;
}

async function main() {
  console.error("Fetching thesis details from Tezara...");
  const theses = await fetchAllThesisDetails();
  console.error(`Fetched ${theses.length} thesis details successfully.`);

  const log = {
    flowId: "reanalysis_script",
    lastTokens: undefined,
    lastPayloadPath: undefined,
    file: () => {},
    groupStart: () => {},
    groupEnd: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    preview: () => {},
    step: () => {},
    data: () => {},
    prompt: () => {},
    saveDebugPayload: () => undefined,
  } as unknown as Logger;

  console.error("Running analysis with updated prompt (3'erli batch)...");
  const result = await analyzeOriginalityRisk(
    {
      mainActors: MATRIX.mainActors,
      researchFocus: MATRIX.researchFocus,
      context: MATRIX.context,
      theoreticalFramework: MATRIX.theoreticalFramework,
      methodology: MATRIX.methodology,
      mainClaim: MATRIX.mainClaim,
      selectedTheses: theses,
    },
    log,
  );

  console.log(JSON.stringify(result.llmResults, null, 2));
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
