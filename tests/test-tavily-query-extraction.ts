import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Logger, createFlowId } from "../src/lib/logger";
import { extractQueries } from "../src/app/(auth)/onboarding/risk/_services/queries";

const thesisMatrix = {
  studyTitle:
    "Söylem, Çerçeve ve Hegemonya: 1991–1999 Yılları Arasında Kürt Siyasi Hareketinin Söylem Dönüşümü ve Türkiye Sosyalist Soluyla İlişkisi",
  mainClaim:
    "Tezin temel iddiası, Kürt siyasi hareketinin ideolojik ve söylemsel dönüşümünün yalnızca 1999 sonrasında ortaya çıkmadığı; bu dönüşümün temellerinin 1991–1999 döneminde, küresel sosyalist dönüşüm ve Türkiye'deki toplumsal yeniden yapılanma koşulları altında inşa edildiğidir. Bu süreçte hareket, Marksist-Leninist çerçeveden demokrasi, insan hakları ve siyasal katılım merkezli yeni bir söylemsel çerçeveye yönelmiş; bu dönüşüm Türkiye sosyalist soluyla kurduğu ilişkiyi de yeniden yapılandırmıştır.",
  theoreticalFramework:
    "Birincil kuramsal çerçeve: Çerçeveleme Teorisi (Frame Analysis) — özellikle Snow ve Benford'un diagnostik, prognostik ve motivasyonel çerçeveler yaklaşımı. İkincil kuramsal çerçeve: Gramsci'nin hegemonya kavramı (hegemonik inşa, rıza üretimi, söylemsel meşruiyet). Kuramsal konumlanma: Sosyal hareketler literatürü + söylem ve hegemonya çalışmaları. Çalışma bilinçli olarak post-Marksist söylem teorisi yerine çerçeveleme yaklaşımını tercih etmektedir.",
  methodology:
    "Nitel araştırma tasarımına dayalı tarihsel karşılaştırmalı söylem analizi uygulanacaktır. Analiz, çerçeveleme teorisinden türetilmiş kodlama şemasıyla yürütülecek; kavramsal değişimler, çerçeve kaymaları ve aktörler arası söylemsel etkileşim izlenecektir. Türkiye sosyalist solunun yanıtları Gramscici hegemonya perspektifiyle yorumlanacaktır. Çalışma çift taraflı karşılaştırmalı okuma ve dönemsel izleme mantığıyla ilerlemektedir.",
  dataStrategy:
    "Birincil kaynaklar: (i) Kürt siyasi hareketi: Özgür Gündem ve devamı yayınlar; HEP, DEP, HADEP parti programları, kongre belgeleri ve savunma metinleri. (ii) Türkiye sosyalist solu: Özgürlük Dünyası ve Gelenek dergileri. İkincil kaynaklar: Kürt hareketi, sosyal hareketler ve Türkiye solu literatürü; mevcut akademik çalışmalar ve tarihsel analizler. Veri stratejisi: Çift taraflı arşiv taraması ve karşılıklı söylem eşleştirmesi.",
  historicalLimits:
    "1991–1999. Başlangıç noktası Sovyetler Birliği'nin çözülmesi ve yeni küresel söylemsel bağlamın oluşması; bitiş noktası Abdullah Öcalan'ın tutuklanması ve sonrasında görünür hale gelen ideolojik dönüşümün eşiğidir. Analitik olarak dönem 1991–1995 ve 1995–1999 olmak üzere iki alt evreye ayrılacaktır.",
  spatialLimits:
    "Türkiye. Odak alan Türkiye'de faaliyet gösteren Kürt siyasi hareketi ile Türkiye sosyalist soludur. Çalışma özellikle ulusal düzeyde yayımlanan parti belgeleri, basın organları ve düşünsel üretim alanına odaklanmaktadır; belirli bir şehir ya da yerel vaka analizi yürütülmeyecektir.",
  analyticalFocus:
    "Birincil aktörler: Kürt siyasi hareketi (PKK ile ilişkili söylemsel alan; HEP–DEP–HADEP çizgisi) ve Türkiye sosyalist solu (özellikle Özgürlük Dünyası ve Gelenek çevresi). İncelenen birimler: Parti programları, gazete yazıları, ideolojik metinler, siyasal açıklamalar ve söylemsel çerçeveler. Analitik odak: Söylem dönüşümü, çerçeve değişimi, meşruiyet üretimi, koalisyon dili ve hegemonik ilişki kurma girişimleri.",
};

async function runOnce(index: number): Promise<void> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  const result = await extractQueries(
    {
      studyTitle: thesisMatrix.studyTitle,
      mainClaim: thesisMatrix.mainClaim,
      theoreticalFramework: thesisMatrix.theoreticalFramework,
      methodology: thesisMatrix.methodology,
      dataStrategy: thesisMatrix.dataStrategy,
      historicalLimits: thesisMatrix.historicalLimits,
      spatialLimits: thesisMatrix.spatialLimits,
      analyticalFocus: thesisMatrix.analyticalFocus,
    },
    log,
  );

  result.tavilyQueries.forEach((q) => console.log(`[${index}] ${q}`));
}

async function main() {
  const N = 5;
  console.log(`\nTavily sorgu üretimi ${N} kez paralel test ediliyor...\n`);

  const tasks = Array.from({ length: N }, (_, i) => runOnce(i + 1));

  try {
    await Promise.all(tasks);
  } catch (error) {
    console.error("Hata:", error);
    process.exit(1);
  }
}

main();
