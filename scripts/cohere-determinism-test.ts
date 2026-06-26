/**
 * Cohere Rerank Determinism Test
 *
 * Runs the rerank pipeline 3 times against the same TEZARA pool and thesis matrix,
 * then verifies that relevance scores and top-15 selections are 100% identical.
 *
 * Usage: COHERE_API_KEY="sk-..." npx tsx scripts/cohere-determinism-test.ts
 */

import { Logger } from "@/lib/logger";
import { rerankTheses } from "@/lib/cohere";
import { searchTezara } from "@/lib/tezara";
import type { TezaraThesisSummary } from "@/lib/types";

// ─── Thesis Matrix (fixed across all 3 runs) ───────────────────────

const MATRIX = {
  studyTitle:
    "Neoliberal Cagda Fert Bazli Kredi Yukumlulugunun Siyasal Tahakkum Araci Olarak Isleyisi: Turkiye Ornegi Uzerinden Bir Inceleme",
  researchQuestion: [
    "Neoliberal sistemde kisisel kredi borclari, siyasi egemenlik iliskilerini hangi yollarla yeniden uretir?",
    "Borc altindaki bireyler, bu borclanma dinamiginin surdurulmesine nasil aktif olarak katki sunar?",
    "Emekci kesimlerin borclanma gerekceleri (yeniden uretim ve gelecege yonelik dayaniklilik) hangi toplumsal dinamikleri aciga cikarir?",
    "Borclulara yonelik boyun egdirme pratikleri, hem oz-denetim hem dissal mudahale duzeyinde ne tur mekanizmalarla isler?",
    "Turkiye baglaminda, borcluluga karsi kitlesel bir siyasi direnisin olmayisi, nesnel kosullarin oznellige donusumundeki hangi engellerle aciklanabilir?",
  ].join(" "),
  mainClaim:
    "Literaturde hakim olan gorusun aksine, borclandirma iliskisinin isleyisi yalnizca yapisal veya kurumsal etkenlerle aciklanamaz; asil belirleyici unsur, bu iliskinin icinde yer alan ve cesitli pratiklerle sureci sekillendiren borclu oznelerin kendisidir – dolayisiyla calisma, mikro duzeydeki ozne eylemlerini ve soylemlerini analize dahil ederek neoliberal borc rejimine dair anlayisa ozgun bir katki sunar.",
  theoreticalFramework:
    "Foucault'nun iktidar analizi (ozellikle yonetimsellik ve oznelesme surecleri), Marksist sinif perspektifi (emek-sermaye celiskisi ve isci sinifinin konumu), bu iki gelenegin kesisminde borclanmayi hem bir tahakkum teknigi hem de ozne kurma pratigi olarak ele alan yaklasim.",
  methodology:
    "Nitel arastirma deseni kapsaminda, Turkiye'de yasayan borclu bireylerle yari-yapilandirilmis derinlemesine gorusmeler gerceklestirilmistir. Elde edilen ham veriler, tematik kodlama yoluyla cozumlenmis; borclanma gerekceleri, yonetim teknikleri ve tepki bicimleri olmak uzere uc ana kategori etrafinda sistematik olarak degerlendirilmistir.",
  researchScope:
    "Calisma, mekan olarak Turkiye ile sinirlidir; zaman acisindan net bir tarih araligi belirtilmese de guncel neoliberal donemi kapsamaktadir. Odak aktorler, borclanmis isci sinifina mensup bireylerdir; bankalar, duzenleyici kurumlar veya devlet aygitlari dogrudan incelenmemekte, yalnizca borclu oznelerin deneyimleri ve soylemleri merkeze alinmaktadir.",
};

// ─── Rerank query (same format as sifting.ts builds) ───────────────

const RERANK_QUERY = [
  `studyTitle: ${MATRIX.studyTitle}`,
  `researchQuestion: ${MATRIX.researchQuestion}`,
  `mainClaim: ${MATRIX.mainClaim}`,
  `theoreticalFramework: ${MATRIX.theoreticalFramework}`,
  `methodology: ${MATRIX.methodology}`,
  `researchScope: ${MATRIX.researchScope}`,
].join("\n");

// ─── Fixed TEZARA keyword set (avoid Gemini variability) ───────────

const TEZARA_QUERIES = [
  "neoliberal borç bireysel kredi tahakkum",
  "subjectivity labor process governmentality",
  "borcluluk özne iktidar Foucault",
  "kredi yukumlulugu siyasal ekonomi",
  "emek sinif neoliberal yonetimsellik",
  "borc oznellik direnis mikro iktidar",
];

// ─── Logger ─────────────────────────────────────────────────────────

const log = new Logger("determinism-test");

// ─── Helpers ────────────────────────────────────────────────────────

function formatTop5(
  results: { index: number; relevanceScore: number }[],
  pool: TezaraThesisSummary[],
): { rank: number; id: number; title: string; score: number }[] {
  return results.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    id: pool[r.index].id,
    title: pool[r.index].title.split(" / ")[0].trim(),
    score: r.relevanceScore,
  }));
}

function scoresDiffer(a: number, b: number): boolean {
  // Compare to 10 decimal places
  return Math.abs(a - b) > 1e-10;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  if (!process.env.COHERE_API_KEY) {
    console.error("HATA: COHERE_API_KEY ortam degiskeni tanimli degil.");
    console.error(
      "Kullanım: COHERE_API_KEY='sk-...' npx tsx scripts/cohere-determinism-test.ts",
    );
    process.exit(1);
  }

  console.log("=".repeat(78));
  console.log("  COHERE RERANK — 3'LU DETERMINIZM TESTI");
  console.log("=".repeat(78));

  // ─── ADIM 1: TEZARA havuzunu tek seferde olustur ─────────────────

  console.log("\n[ADIM 1] TEZARA havuzu olusturuluyor...\n");

  const seenIds = new Set<number>();
  const pool: TezaraThesisSummary[] = [];

  for (let i = 0; i < TEZARA_QUERIES.length; i++) {
    const q = TEZARA_QUERIES[i];
    process.stdout.write(`  [${i + 1}/${TEZARA_QUERIES.length}] "${q}" -> `);
    const results = await searchTezara(q, log);

    let newCount = 0;
    for (const r of results) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        pool.push(r);
        newCount++;
      }
    }
    console.log(
      `${results.length} sonuc, ${newCount} yeni (toplam ${pool.length})`,
    );
  }

  console.log(`\n  Toplam ${pool.length} essiz tez ile test edilecek.\n`);

  if (pool.length === 0) {
    console.error("HATA: TEZARA'da hic tez bulunamadi.");
    process.exit(1);
  }

  // Pool title'larini bir kere olustur
  const titles = pool.map((t) => t.title);

  // ─── ADIM 2: 3 kez rerank calistir ───────────────────────────────

  console.log("[ADIM 2] Cohere Rerank 3 kez calistiriliyor...\n");

  const runs: {
    run: number;
    results: { index: number; relevanceScore: number }[];
    searchUnits: number;
  }[] = [];

  for (let run = 1; run <= 3; run++) {
    const { results, searchUnits } = await rerankTheses(
      RERANK_QUERY,
      titles,
      log,
    );

    const sorted = [...results].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );
    runs.push({ run, results: sorted, searchUnits });

    const top5 = formatTop5(sorted, pool);
    console.log(`  --- Test ${run} (searchUnits: ${searchUnits}) ---`);
    for (const t of top5) {
      console.log(
        `    #${t.rank}  ID:${String(t.id).padEnd(6)} Skor:${t.score.toFixed(6).padEnd(10)} ${t.title}`,
      );
    }
    console.log();
  }

  // ─── ADIM 3: Karsilastirma & Determinizm Dogrulamasi ─────────────

  console.log("[ADIM 3] 3 testin karsilastirmasi yapiliyor...\n");

  const r1 = runs[0];
  const r2 = runs[1];
  const r3 = runs[2];

  // Skor ve siralama karsilastirmasi
  let scoresMatch12 = true;
  let scoresMatch13 = true;
  let scoresMatch23 = true;

  for (
    let i = 0;
    i < Math.max(r1.results.length, r2.results.length, r3.results.length);
    i++
  ) {
    if (i < r1.results.length && i < r2.results.length) {
      if (
        scoresDiffer(r1.results[i].relevanceScore, r2.results[i].relevanceScore)
      ) {
        scoresMatch12 = false;
      }
    }
    if (i < r1.results.length && i < r3.results.length) {
      if (
        scoresDiffer(r1.results[i].relevanceScore, r3.results[i].relevanceScore)
      ) {
        scoresMatch13 = false;
      }
    }
    if (i < r2.results.length && i < r3.results.length) {
      if (
        scoresDiffer(r2.results[i].relevanceScore, r3.results[i].relevanceScore)
      ) {
        scoresMatch23 = false;
      }
    }
  }

  // ID sirasi karsilastirmasi
  const idOrder1 = r1.results.slice(0, 15).map((r) => pool[r.index].id);
  const idOrder2 = r2.results.slice(0, 15).map((r) => pool[r.index].id);
  const idOrder3 = r3.results.slice(0, 15).map((r) => pool[r.index].id);

  const orderMatch12 = idOrder1.every((id, i) => id === idOrder2[i]);
  const orderMatch13 = idOrder1.every((id, i) => id === idOrder3[i]);

  // Fatura birimi karsilastirmasi
  const unitsMatch =
    r1.searchUnits === r2.searchUnits && r2.searchUnits === r3.searchUnits;

  // ─── RAPOR ────────────────────────────────────────────────────────

  console.log("=".repeat(78));
  console.log("  DETERMINIZM RAPORU");
  console.log("=".repeat(78));

  console.log(`\n  Havuz: ${pool.length} essiz tez`);

  console.log(`\n  ┌──────────────────────┬──────────┬──────────┬──────────┐`);
  console.log(`  │ Metrik               │ Test 1   │ Test 2   │ Test 3   │`);
  console.log(`  ├──────────────────────┼──────────┼──────────┼──────────┤`);

  const top5_1 = formatTop5(r1.results, pool);
  const top5_2 = formatTop5(r2.results, pool);
  const top5_3 = formatTop5(r3.results, pool);

  for (let i = 0; i < 5; i++) {
    const t1 = top5_1[i];
    const t2 = top5_2[i];
    const t3 = top5_3[i];
    console.log(
      `  │ #${i + 1} ID               │ ${String(t1.id).padEnd(8)} │ ${String(t2.id).padEnd(8)} │ ${String(t3.id).padEnd(8)} │`,
    );
    console.log(
      `  │ #${i + 1} Skor             │ ${t1.score.toFixed(6).padEnd(8)} │ ${t2.score.toFixed(6).padEnd(8)} │ ${t3.score.toFixed(6).padEnd(8)} │`,
    );
  }

  console.log(`  ├──────────────────────┼──────────┼──────────┼──────────┤`);
  console.log(
    `  │ searchUnits          │ ${String(r1.searchUnits).padEnd(8)} │ ${String(r2.searchUnits).padEnd(8)} │ ${String(r3.searchUnits).padEnd(8)} │`,
  );
  console.log(`  └──────────────────────┴──────────┴──────────┴──────────┘`);

  console.log(`\n  ┌─────────────────────────────────────────────────────┐`);
  console.log(`  │ DOGRULAMA                                          │`);
  console.log(`  ├─────────────────────────────────────────────────────┤`);

  const allScoresMatch = scoresMatch12 && scoresMatch13 && scoresMatch23;
  const allOrdersMatch = orderMatch12 && orderMatch13;
  const allUnitsMatch = unitsMatch;

  console.log(`  │ Skorlar Test1=Test2: ${String(scoresMatch12).padEnd(26)}│`);
  console.log(`  │ Skorlar Test1=Test3: ${String(scoresMatch13).padEnd(26)}│`);
  console.log(`  │ Skorlar Test2=Test3: ${String(scoresMatch23).padEnd(26)}│`);
  console.log(`  │ ID Sirasi Test1=Test2: ${String(orderMatch12).padEnd(22)}│`);
  console.log(`  │ ID Sirasi Test1=Test3: ${String(orderMatch13).padEnd(22)}│`);
  console.log(`  │ searchUnits esit: ${String(unitsMatch).padEnd(26)}│`);
  console.log(`  ├─────────────────────────────────────────────────────┤`);

  if (allScoresMatch && allOrdersMatch && allUnitsMatch) {
    console.log(`  │ SONUC: %100 DETERMINISTIK ✓                         │`);
    console.log(`  │ Rastgelelik/sapma yok. Sifir tolerans.             │`);
  } else {
    console.log(`  │ SONUC: DETERMINIZM BASARISIZ ✗                     │`);
    if (!allScoresMatch)
      console.log(`  │ Sebep: Skorlar eslesmiyor                         │`);
    if (!allOrdersMatch)
      console.log(`  │ Sebep: Siralama eslesmiyor                        │`);
    if (!allUnitsMatch)
      console.log(`  │ Sebep: searchUnits farkli                         │`);
  }
  console.log(`  └─────────────────────────────────────────────────────┘`);

  console.log("\n  Test tamamlandi.\n");
}

main().catch((err) => {
  console.error("\n  HATA:", err);
  process.exit(1);
});
