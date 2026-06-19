/**
 * Sifting Dayanıklılık (Resilience) Testi — Zehirli Makale Sızma Denemesi
 *
 * Bu script, literatür tarama pipeline'ının AI eleme (sifting) aşamasının
 * konuyla tamamen alakasız "zehirli (toxic)" makalelere karşı direncini ölçer.
 *
 * Akış:
 *   1. Gerçek OpenAlex semantik araması yapılır (43 civarı makale)
 *   2. Sonuçlara 3 adet tamamen alakasız sahte makale enjekte edilir
 *   3. Karışık havuz runSiftingStage (Gemini LOW Thinking) ile elenir
 *   4. 3 zehirli makalenin ACCEPT mi yoksa REJECT mi edildiği raporlanır
 *
 * Kullanım:
 *   npx tsx tests/test-sifting-resilience.ts
 *
 * Gereksinimler:
 *   - .env.local dosyasında GEMINI_API_KEY ve OPENALEX_API_KEY tanımlı olmalıdır
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Logger, createFlowId } from "../src/lib/logger";
import type { ValidatedPaper } from "../src/app/(auth)/onboarding/literature-review/_services/literature-review-papers";
import { mergePapers } from "../src/app/(auth)/onboarding/literature-review/_services/literature-review-papers";
import {
  searchOpenAlex,
  resolveFoundationalWorks,
} from "../src/app/(auth)/onboarding/literature-review/_services/search-api";
import { runSiftingStage } from "../src/app/(auth)/onboarding/literature-review/_services/ai-processor";

// ============================================================================
// GIRDI VERILERI (test-literature-review.ts ile birebir ayni)
// ============================================================================

const subBox = {
  title: "Gramscici Hegemonya Kuramı ve Söylem",
  description:
    "Kürt siyasi hareketi ve Türkiye sosyalist solu arasındaki rıza üretimi, hegemonik meşruiyet arayışları ve söylemsel etkileşimi açıklayan Marksist-Gramscici teorik çerçeve.",
  semanticSearchBlock:
    "The Gramscian concept of hegemony provides an essential analytical framework for understanding the dialectical relationship between political movements and the production of cultural and discursive legitimacy. Central to this approach is the capacity of movements to construct counter-hegemonic narratives that challenge state-sanctioned ideologies. By applying this lens to the interplay between the Kurdish political movement and the Turkish socialist left, we can investigate how discursive alliances are forged and maintained through the constant renegotiation of political consent.",
  foundationalQueries: [
    {
      title: "Selections from the Prison Notebooks",
      author: "Antonio Gramsci",
      publicationYear: 1971,
    },
    {
      title:
        "Hegemony and Socialist Strategy: Towards a Radical Democratic Politics",
      author: "Ernesto Laclau and Chantal Mouffe",
      publicationYear: 1985,
    },
  ],
};

const thesisCtx = {
  studyTitle:
    "Söylem, Çerçeve ve Hegemonya: 1991–1999 Yılları Arasında Kürt Siyasi Hareketinin Söylem Dönüşümü ve Türkiye Sosyalist Soluyla İlişkisi",
  researchQuestion:
    "1991–1999 yılları arasında Kürt siyasi hareketi Marksist-Leninist söylemden demokrasi, insan hakları ve demokratik siyaset söylemine nasıl bir geçiş gerçekleştirmiştir; bu dönüşümü hangi yapısal koşullar şekillendirmiştir; ve Türkiye sosyalist solu bu dönüşüme nasıl yanıt vermiştir?",
  theoreticalFramework:
    "Birincil kuramsal çerçeve: Çerçeveleme Teorisi (Frame Analysis) — Snow ve Benford'un diagnostik, prognostik ve motivasyonel çerçeveler yaklaşımı. İkincil kuramsal çerçeve: Gramsci'nin hegemonya kavramı (hegemonik inşa, rıza üretimi, söylemsel meşruiyet).",
  historicalLimits:
    "1991–1999. Başlangıç noktası Sovyetler Birliği'nin çözülmesi; bitiş noktası Abdullah Öcalan'ın tutuklanması.",
  spatialLimits:
    "Türkiye. Odak alan Türkiye'de faaliyet gösteren Kürt siyasi hareketi ile Türkiye sosyalist soludur.",
};

// ============================================================================
// ZEHIRLI MAKALELER (Toxic Articles)
// ============================================================================

const TOXIC_ARTICLES: ValidatedPaper[] = [
  {
    title:
      "A Deep Learning Approach to Optimizing Convolutional Neural Networks for Real-Time Image Recognition",
    abstract:
      "Ametis consectetur adipiscing elit. This paper proposes a novel deep convolutional neural network architecture optimized for real-time image recognition tasks. We introduce a residual attention mechanism that reduces computational overhead by 37% while maintaining 94.2% top-5 accuracy on ImageNet. Extensive experiments on GPU clusters demonstrate superior inference latency compared to state-of-the-art models such as ResNet-152 and EfficientNet.",
    metadata: null,
    doi: null,
    url: "https://example.com/toxic-cnn",
    authors: ["Wei Zhang", "Priya Sharma", "James Mitchell"],
    year: 2024,
    publisher: "IEEE Transactions on Pattern Analysis",
    openAlexId: "TOXIC_DL_CNN_IMAGE_RECOGNITION",
    isFoundational: false,
    relevanceScore: 0.91,
  },
  {
    title:
      "Clinical Efficacy and Long-Term Survival Rates in Laparoscopic Bariatric Surgery",
    abstract:
      "Lorem ipsum dolor sit amet consectetur adipiscing elit. This retrospective cohort study evaluates clinical outcomes and 5-year survival rates in 1,247 patients who underwent laparoscopic Roux-en-Y gastric bypass between 2018 and 2023. Primary endpoints included excess weight loss percentage, remission of type 2 diabetes, and perioperative complication rates. Results demonstrate a 73.4% excess weight loss at 24 months with a 0.8% major complication rate.",
    metadata: null,
    doi: null,
    url: "https://example.com/toxic-bariatric",
    authors: ["Michael O'Brien", "Sarah Chen", "David Kowalski"],
    year: 2024,
    publisher: "Journal of Bariatric Surgery",
    openAlexId: "TOXIC_BARIATRIC_SURGERY_LAPAROSCOPIC",
    isFoundational: false,
    relevanceScore: 0.88,
  },
  {
    title:
      "Supply Chain Resilience and Semiconductor Shortages in the Post-Pandemic Global Market",
    abstract:
      "Dolor sit amet consectetur adipiscing elit. This article analyzes the structural fragility of global semiconductor supply chains following the COVID-19 pandemic. Using a mixed-methods approach combining input-output analysis with 32 semi-structured interviews of supply chain executives, we identify six critical bottlenecks. Findings indicate that geographic concentration of fabrication facilities and just-in-time inventory practices amplify systemic risk exposure.",
    metadata: null,
    doi: null,
    url: "https://example.com/toxic-semiconductor",
    authors: ["Robert K. Merton", "Anna Lindström", "Takashi Yamamoto"],
    year: 2024,
    publisher: "Supply Chain Management Review",
    openAlexId: "TOXIC_SEMICONDUCTOR_SUPPLY_CHAIN",
    isFoundational: false,
    relevanceScore: 0.85,
  },
];

// ============================================================================
// SABITLER
// ============================================================================
const DIVIDER =
  "\n────────────────────────────────────────────────────────────\n";

// ============================================================================
// ANA TEST FONKSİYONU
// ============================================================================
async function main() {
  console.log(DIVIDER);
  console.log("  SIFTING DAYANIKLILIK (RESILIENCE) TESTI");
  console.log('  "Zehirli Makale Sızma" Denemesi');
  console.log(DIVIDER);

  const flowId = createFlowId();
  const logger = new Logger(flowId);

  // ------------------------------------------------------------------
  // PHASE 1: FOUNDATIONAL WORKS
  // ------------------------------------------------------------------
  console.log("\n  🔰 AŞAMA 1: Kurucu Eser Çözümleme (OpenAlex)\n");

  const fStart = performance.now();
  const resolved = await resolveFoundationalWorks(
    subBox.foundationalQueries,
    logger,
  );
  const fDuration = ((performance.now() - fStart) / 1000).toFixed(1);
  console.log(`  ✅ ${resolved.length} kurucu eser çözümlendi (${fDuration}s)`);

  // ------------------------------------------------------------------
  // PHASE 2: SEMANTIC SEARCH
  // ------------------------------------------------------------------
  console.log(DIVIDER);
  console.log("\n  🔍 AŞAMA 2: OpenAlex Semantik Arama\n");

  const sStart = performance.now();
  const semanticRaw = await searchOpenAlex(subBox.semanticSearchBlock);
  const sDuration = ((performance.now() - sStart) / 1000).toFixed(1);
  console.log(`  ✅ ${semanticRaw.length} ham sonuç bulundu (${sDuration}s)`);

  if (semanticRaw.length === 0) {
    console.log("\n  ⚠️  Semantik arama sonuç vermedi. Pipeline sonlandı.");
    process.exit(0);
  }

  // ------------------------------------------------------------------
  // PHASE 3: DEDUP
  // ------------------------------------------------------------------
  console.log(DIVIDER);
  console.log("\n  🔀 AŞAMA 3: Deduplikasyon\n");

  const merged = mergePapers(semanticRaw);
  console.log(
    `  ✅ ${semanticRaw.length} ham → ${merged.length} benzersiz makale`,
  );

  // ------------------------------------------------------------------
  // PHASE 4: TOXIC INJECTION
  // ------------------------------------------------------------------
  console.log(DIVIDER);
  console.log("\n  ☠️  AŞAMA 4: Zehirli Makale Enjeksiyonu\n");

  const poisonedPool = [...merged, ...TOXIC_ARTICLES];

  console.log(`  Temiz makale sayısı: ${merged.length}`);
  console.log(`  Enjekte edilen zehirli makale: ${TOXIC_ARTICLES.length}`);
  console.log(`  Toplam aday: ${poisonedPool.length}`);
  console.log("");
  TOXIC_ARTICLES.forEach((t, i) => {
    console.log(`  ☠️  Toksin #${i + 1}:`);
    console.log(`     ID  : ${t.openAlexId}`);
    console.log(`     Başlık: ${t.title.slice(0, 80)}...`);
    console.log(`     Skor: ${t.relevanceScore}`);
    console.log("");
  });

  // ------------------------------------------------------------------
  // PHASE 5: AI SIFTING (GEMINI LOW THINKING)
  // ------------------------------------------------------------------
  console.log(DIVIDER);
  console.log("\n  🧠 AŞAMA 5: AI Eleme (Sifting) — Gemini LOW Thinking\n");
  console.log("  Model: gemini-3.1-flash-lite, ThinkingLevel: LOW\n");

  const siftStart = performance.now();
  logger.info("sifting_resilience_test_start", {
    service: "literature",
    data: {
      candidateCount: poisonedPool.length,
      toxicCount: TOXIC_ARTICLES.length,
    },
  });

  const sifted = await runSiftingStage(subBox, poisonedPool, logger, thesisCtx);
  const siftDuration = ((performance.now() - siftStart) / 1000).toFixed(1);

  // ------------------------------------------------------------------
  // PHASE 6: ANALYSE TOXIC FATE
  // ------------------------------------------------------------------
  console.log(DIVIDER);
  console.log("\n  🔬 AŞAMA 6: Zehirli Makale Kader Analizi\n");

  const siftedIds = new Set(
    sifted.map((s) => s.openAlexId ?? s.doi ?? "title:" + s.title),
  );
  const toxicStatus: { id: string; title: string; accepted: boolean }[] = [];

  for (const t of TOXIC_ARTICLES) {
    const id = t.openAlexId!;
    const accepted = siftedIds.has(id);
    toxicStatus.push({ id, title: t.title, accepted });
  }

  // Summary counters
  const acceptedToxicCount = toxicStatus.filter((t) => t.accepted).length;
  const rejectedToxicCount = toxicStatus.filter((t) => !t.accepted).length;

  // Per-toxin report
  for (const ts of toxicStatus) {
    const icon = ts.accepted ? "  🚨 SIZINTI" : "  ✅ ENGELLENDI";
    const color = ts.accepted ? "ALARM" : "GÜVENLI";
    console.log(`  ${icon} [${color}]`);
    console.log(`     ID  : ${ts.id}`);
    console.log(`     Başlık: ${ts.title.slice(0, 80)}`);
    console.log("");
  }

  // ------------------------------------------------------------------
  // PHASE 7: SUMMARY
  // ------------------------------------------------------------------
  console.log(DIVIDER);
  console.log("  📊 ÖZET RAPORU");
  console.log("  " + "─".repeat(55));
  console.log("  Metrik                                | Değer");
  console.log("  " + "─".repeat(55));
  console.log(`  Temiz makale (girdi)                   | ${merged.length}`);
  console.log(
    `  Zehirli makale (enjekte)               | ${TOXIC_ARTICLES.length}`,
  );
  console.log(
    `  Toplam aday (girdi)                    | ${poisonedPool.length}`,
  );
  console.log(`  Sifting sonrası kalan                  | ${sifted.length}`);
  console.log(
    `  Genel kabul oranı                      | ${((sifted.length / poisonedPool.length) * 100).toFixed(1)}%`,
  );
  console.log(`  Süre                                   | ${siftDuration}s`);
  console.log("  " + "─".repeat(55));
  console.log(
    `  Zehirli makaleler ENGELENDİ            | ${rejectedToxicCount}/${TOXIC_ARTICLES.length}`,
  );
  console.log(
    `  Zehirli makaleler SIZDI (ACCEPT)       | ${acceptedToxicCount}/${TOXIC_ARTICLES.length}`,
  );
  console.log("  " + "─".repeat(55));

  if (acceptedToxicCount > 0) {
    console.log("\n  🚨  UYARI: Zehirli makaleler sifting katmanını aştı!");
    console.log(
      "  Bu makaleler Gemini tarafından ACCEPT edilerek sisteme sızdı.",
    );
    console.log(
      "  Jüri aşamasında (HIGH Thinking) yeniden değerlendirilmeli.\n",
    );
  } else {
    console.log("\n  ✅  BAŞARILI: Tüm zehirli makaleler sifting katmanında");
    console.log("  başarıyla tespit edilip REJECT edildi. Sıfır sızıntı.\n");
  }

  // Detailed analysis
  console.log("  " + "─".repeat(55));
  console.log(
    "  Zehirli Hedef | Başlık (kısaltılmış)                          | Sonuç",
  );
  console.log("  " + "─".repeat(55));
  for (const ts of toxicStatus) {
    const result = ts.accepted ? "🚨 SIZDI" : "✅ ENGELENDI";
    const shortTitle =
      ts.title.length > 45 ? ts.title.slice(0, 42) + "..." : ts.title;
    console.log(`  ${ts.id.padEnd(14)} | ${shortTitle.padEnd(43)} | ${result}`);
  }
  console.log("  " + "─".repeat(55));
}

// ============================================================================
// EXEC
// ============================================================================
main().catch((err) => {
  console.error("\n  ❌ TEST BAŞARISIZ!");
  console.error(`  Hata: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    console.error(`  Stack: ${err.stack.split("\n").slice(0, 4).join("\n")}`);
  }
  process.exit(1);
});
