import { createFlowId, Logger } from "../lib/logger";
import { extractQueries } from "../app/(auth)/onboarding/risk/_services/queries";
import { searchTezara } from "../lib/tezara";
import { siftAndFetchDetails } from "../app/(auth)/onboarding/risk/_services/sifting";
import {
  analyzeOriginalityRisk,
  calculateOriginalityRisk,
} from "../app/(auth)/onboarding/risk/_services/analysis";
import type { TezaraThesisSummary } from "../lib/types";
import { writeFileSync } from "fs";
import path from "path";

interface ThesisMatrixInput {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
}

/**
 * Initial thesis matrix input parameters representing the target topic:
 * "1990'ların Başında Türkiye'de Kürt Siyaseti ile Sosyalist Kesim Arasındaki Söylemsel Etkileşim"
 */
const targetMatrix: ThesisMatrixInput = {
  studyTitle:
    "1990'ların Başında Türkiye'de Kürt Siyaseti ile Sosyalist Kesim Arasındaki Söylemsel Etkileşimin İncelenmesi (1991–1999)",
  researchQuestion:
    "1991–1999 periyodunda Kürt siyasal hareketinin söylemsel zemininde yaşanan değişimin yönü neydi ve bu değişimi hangi dışsal zorunluluklar biçimlendirdi?\n\nSosyalist çevrelerin bu ideolojik kaymaya yönelik yaklaşımı ne şekilde tezahür etmiş, bu yaklaşım zaman içerisinde hangi aşamalardan geçmiştir?\n\nTaraflar arasındaki bu karşılıklı söylem alışverişi, dönemin siyasi ikliminde nasıl bir örüntü ortaya koymaktadır?",
  theoreticalFramework:
    'Snow ile Benford\'un "Çerçeveleme" yaklaşımı ve Gramsci\'nin "Rıza ve Hegemonya" düşüncesi (temel başvuru kaynakları olarak).',
  methodology:
    "Veri seti: 1991-1999 aralığında faaliyet gösteren Özgür Gündem ve türevi yayınlar; HEP, DEP ve HADEP'in siyasi metinleri; sol camiayı temsilen Özgürlük Dünyası ve Gelenek dergileri.\n\nTeknik: Belirlenen kavramsal araçlar eşliğinde geliştirilmiş bir kodlama cetveli aracılığıyla metinlerin sistematik olarak çözümlenmesi.\n\nZaman dilimlemesi: Söylemdeki kırılmaları yakalamak adına dönem, 1991-1995 ve 1995-1999 olarak iki ayrı evrede ele alınacaktır.",
  researchScope:
    "Zaman: 1991 başlangıcı ile 1999 bitişi arası.\n\nMekân ve Aktör: Türkiye özelinde, yalnızca Kürt hareketinin kamusal/yazılı beyanları ile Türkiye solu temsilcilerinin kaleme aldığı düşünce metinleri.\n\nKapsam dışı tutulanlar: Askeri kanat faaliyetleri, doğrudan devlet güvenlik stratejileri ve 1999 sonrası dönemin siyasal gelişmeleri bu çalışmanın dışındadır.",
  mainClaim:
    "Bu araştırma, 1990'larda Kürt hareketinin Marksist-Leninist argümanlardan demokrasi ve hak temelli bir söze evrilmesinin, Türkiye solunun bu geçişe yönelik kimi zaman destek kimi zaman çekimser ya da itiraz içeren tepkilerinden ayrı düşünülemeyeceğini; dolayısıyla 1999 öncesi evrenin yalnızca bir ön hazırlık süreci değil, iki aktörlü bir inşa ve mücadele alanı olduğunu ileri sürmektedir.",
};

/**
 * No-op logger that silences all project-internal logging output.
 * Extends Logger to satisfy TypeScript's nominal private-member compatibility,
 * then overrides every public method to suppress output.
 */
class SilentLogger extends Logger {
  constructor(flowId: string) {
    super(flowId);
  }

  override info(): void {}
  override warn(): void {}
  override error(): void {}
  override step(): void {}
  override file(): void {}
  override data(): void {}
  override preview(): void {}
  override prompt(): void {}
  override saveDebugPayload(): string | undefined {
    return undefined;
  }
}

const RUN_LABEL = process.env.RUN_LABEL || "";
const OUTPUT_PATH = path.resolve(process.cwd(), `e2e-output${RUN_LABEL}.json`);

/**
 * Runs the E2E originality analysis pipeline using only real project functions.
 * Terminal shows minimal progress; full detailed JSON is written to e2e-output.json.
 * Tavily is fully bypassed (queries extracted but never executed).
 */
async function runE2ETest(): Promise<void> {
  const flowId = createFlowId();
  const log = new SilentLogger(flowId);

  try {
    // Adim 1: Query Extraction (Gemini)
    process.stdout.write("[1] Gemini sorgu cikarma... ");
    const extracted = await extractQueries(targetMatrix, log);
    console.log("tamamlandi");

    // Adim 2: Tezara Search
    process.stdout.write("[2] Tezara taramasi... ");
    const tezaraSearchResults: TezaraThesisSummary[][] = [];
    for (const query of extracted.tezaraQueries) {
      const results = await searchTezara(query, log, true);
      tezaraSearchResults.push(results);
    }
    console.log("tamamlandi");

    // Adim 3: Cohere Rerank
    process.stdout.write("[3] Cohere Rerank suzme... ");
    const siftResult = await siftAndFetchDetails(targetMatrix, tezaraSearchResults, log);
    console.log("tamamlandi");

    // Adim 4: Gemini Juri + Risk Hesaplama
    process.stdout.write("[4] Gemini juri analizi... ");
    if (siftResult.finalTheses.length === 0) {
      console.log("aday tez kalmadi!");
      return;
    }

    const { overlapTable } = await analyzeOriginalityRisk(
      {
        ...targetMatrix,
        validDetails: siftResult.finalTheses,
      },
      log,
    );

    const riskCalcResult = calculateOriginalityRisk(overlapTable, siftResult.finalTheses, log);
    console.log("tamamlandi");

    // Write full results to file
    const output = {
      metadata: {
        flowId,
        completedAt: new Date().toISOString(),
        studyTitle: targetMatrix.studyTitle,
        tezaraQueries: extracted.tezaraQueries,
        totalCandidates: tezaraSearchResults.flat().length,
        afterRerank: siftResult.finalTheses.length + siftResult.eliminatedTheses.length,
        finalAday: siftResult.finalTheses.length,
        eliminatedByRerank: siftResult.eliminatedTheses.length,
      },
      globalBadge: riskCalcResult.originalityBadge,
      overlapTable: riskCalcResult.overlapTable,
      eliminatedTheses: riskCalcResult.eliminatedTheses,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
    console.log("\nSonuclar kaydedildi: e2e-output.json");
  } catch (err) {
    console.error("\nHATA:", err);
    process.exit(1);
  }
}

runE2ETest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Kritik hata:", err);
    process.exit(1);
  });
