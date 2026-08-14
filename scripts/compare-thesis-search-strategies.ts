import { db } from "../src/db";
import { matrices } from "../src/db/schema";
import { generatePositioningQueries } from "../src/features/positioning/queries";
import { searchTezara } from "../src/features/tezara";
import { rerankWithCohere } from "../src/services/ai/cohere";
import type { TezaraThesisDetails } from "../src/lib/types";

function formatThesisToYaml(thesis: TezaraThesisDetails): string {
  return [`Title: ${thesis.title}`, `Abstract: ${thesis.abstract}`].join("\n");
}

async function main() {
  console.log("==========================================================================");
  console.log("   FABRICCA - 3 FARKLI TEZ ARAMA STRATEJİSİNİN KARŞILAŞTIRMALI TESTİ     ");
  console.log("==========================================================================\n");

  // 1. DB'den gerçek matrisi çek
  const matrixRows = await db.select().from(matrices).limit(1);
  if (!matrixRows || matrixRows.length === 0) {
    throw new Error("Veritabanında matris kaydı bulunamadı.");
  }

  const matrix = matrixRows[0];
  const matrixInput = {
    subjectProblem: matrix.subjectProblem,
    theoreticalFramework: matrix.theoreticalFramework,
    methodology: matrix.methodology,
  };

  console.log("📌 KULLANICI TEZ MATRİSİ ÖZETİ:");
  console.log(`Araştırma Problemi: "${matrix.subjectProblem.slice(0, 180)}..."\n`);

  // Gemini ile 8 sorguyu üret
  console.log("🤖 Gemini Flash ile 8 Semantik Sorgu Üretiliyor...");
  const queriesStart = performance.now();
  const generatedQueries = await generatePositioningQueries(matrixInput);
  console.log(`✅ Sorgular üretildi (${Math.round(performance.now() - queriesStart)}ms):`);
  console.log("  TR-1:", generatedQueries.subjectTr_alt1);
  console.log("  TR-2:", generatedQueries.subjectTr_alt2);
  console.log("  TR-3:", generatedQueries.subjectTr_alt3);
  console.log("  TR-4:", generatedQueries.subjectTr_alt4);
  console.log("  EN-1:", generatedQueries.subjectEn_alt1);
  console.log("  EN-2:", generatedQueries.subjectEn_alt2);
  console.log("  EN-3:", generatedQueries.subjectEn_alt3);
  console.log("  EN-4:", generatedQueries.subjectEn_alt4);
  console.log("\n--------------------------------------------------------------------------");

  // =========================================================================
  // STRATEJİ 1: Sadece Tezin Kendisi (Tek Vektör)
  // =========================================================================
  console.log("\n🔵 [STRATEJİ 1: SADECE TEZİN KENDİSİ VEKTÖRLEŞİNCE]");
  const s1Start = performance.now();
  // 512 token sınırına uygun olarak subjectProblem'in özünü veriyoruz
  const directQuery = matrix.subjectProblem.slice(0, 450);
  const s1Theses = await searchTezara(directQuery, undefined, { limit: 40 });
  const s1Time = Math.round(performance.now() - s1Start);

  console.log(`  ⏱️ Süre: ${s1Time}ms | Bulunan Aday Sayısı: ${s1Theses.length}`);

  // =========================================================================
  // STRATEJİ 2: Sadece 8 Üretilen Sorgu
  // =========================================================================
  console.log("\n🟣 [STRATEJİ 2: SADECE 8 ÜRETİLEN SORGU İLE]");
  const s2Start = performance.now();
  const s2Queries = [
    generatedQueries.subjectTr_alt1,
    generatedQueries.subjectTr_alt2,
    generatedQueries.subjectTr_alt3,
    generatedQueries.subjectTr_alt4,
    generatedQueries.subjectEn_alt1,
    generatedQueries.subjectEn_alt2,
    generatedQueries.subjectEn_alt3,
    generatedQueries.subjectEn_alt4,
  ];

  const s2ResultsArray = await Promise.all(
    s2Queries.map((q) => searchTezara(q, undefined, { limit: 25 })),
  );

  const s2Map = new Map<number, TezaraThesisDetails>();
  for (const arr of s2ResultsArray) {
    for (const t of arr) {
      if (t.id && !s2Map.has(t.id)) s2Map.set(t.id, t);
    }
  }
  const s2Theses = Array.from(s2Map.values());
  const s2Time = Math.round(performance.now() - s2Start);

  console.log(`  ⏱️ Süre: ${s2Time}ms | Tekilleştirilmiş Aday Sayısı: ${s2Theses.length}`);

  // =========================================================================
  // STRATEJİ 3: Tezin Kendisi (0. Sorgu) + 8 Üretilen Sorgu = 9 Sorgu
  // =========================================================================
  console.log("\n🟢 [STRATEJİ 3: TEZİN KENDİSİ (0. SORGU) + 8 ÜRETİLEN SORGU (TOPLAM 9)]");
  const s3Start = performance.now();
  const s3Queries = [directQuery, ...s2Queries];

  const s3ResultsArray = await Promise.all(
    s3Queries.map((q) => searchTezara(q, undefined, { limit: 25 })),
  );

  const s3Map = new Map<number, TezaraThesisDetails>();
  for (const arr of s3ResultsArray) {
    for (const t of arr) {
      if (t.id && !s3Map.has(t.id)) s3Map.set(t.id, t);
    }
  }
  const s3Theses = Array.from(s3Map.values());
  const s3Time = Math.round(performance.now() - s3Start);

  console.log(`  ⏱️ Süre: ${s3Time}ms | Tekilleştirilmiş Aday Sayısı: ${s3Theses.length}`);

  // =========================================================================
  // COHERE RERANK İLE KALİTE VE ALAKA DEĞERLENDİRMESİ
  // =========================================================================
  console.log("\n==========================================================================");
  console.log("            COHERE RERANK v4.0 PRO İLE EN İYİ İLK 5 TEZ ANALİZİ          ");
  console.log("==========================================================================");

  const rerankQuery = `SubjectProblem: ${matrix.subjectProblem}`;

  async function rankAndDisplay(theses: TezaraThesisDetails[], strategyName: string) {
    // Filtrele: özet uzunluğu >= 100
    const filtered = theses.filter((t) => t.abstract && t.abstract.trim().length >= 100);
    const docs = filtered.map(formatThesisToYaml);

    if (docs.length === 0) {
      console.log(`\n[${strategyName}] Uygun özetli aday bulunamadı.`);
      return;
    }

    const rerankRes = await rerankWithCohere({
      query: rerankQuery,
      documents: docs,
    });

    console.log(`\n🏆 ${strategyName} (Toplam Değerlendirilen: ${filtered.length} Tez)`);
    const top5 = rerankRes.slice(0, 5);

    top5.forEach((item, idx) => {
      const t = filtered[item.index];
      const score = (item.relevanceScore * 100).toFixed(1);
      console.log(`  ${idx + 1}. [Skor: %${score}] [${t.year}] ${t.title}`);
      console.log(`     Yazar: ${t.author} | Ünv: ${t.university} | Tür: ${t.thesisType}`);
      console.log(`     Özet: ${t.abstract.slice(0, 140)}...\n`);
    });
  }

  await rankAndDisplay(s1Theses, "STRATEJİ 1: Sadece Tezin Kendisi");
  await rankAndDisplay(s2Theses, "STRATEJİ 2: Sadece 8 Üretilen Sorgu");
  await rankAndDisplay(s3Theses, "STRATEJİ 3: Tezin Kendisi (0. Sorgu) + 8 Sorgu (Toplam 9)");

  // Küme Kesişimi Analizi
  const s1Ids = new Set(s1Theses.map((t) => t.id));
  const s2Ids = new Set(s2Theses.map((t) => t.id));
  const commonIds = s1Theses.filter((t) => s2Ids.has(t.id)).map((t) => t.id);
  const onlyS1 = s1Theses.filter((t) => !s2Ids.has(t.id)).map((t) => t.id);
  const onlyS2 = s2Theses.filter((t) => !s1Ids.has(t.id)).map((t) => t.id);

  console.log("==========================================================================");
  console.log("                        KÜME KESİŞİM VE FARK ANALİZİ                     ");
  console.log("==========================================================================");
  console.log(` S1 (Tezin Kendisi) Toplam Aday       : ${s1Theses.length}`);
  console.log(` S2 (8 Sorgu) Toplam Aday             : ${s2Theses.length}`);
  console.log(` S3 (9 Sorgu) Toplam Aday             : ${s3Theses.length}`);
  console.log(` Ortak Yakalanan Tez Sayısı           : ${commonIds.length}`);
  console.log(` SADECE S1'in Yakaladığı Özel Tezler  : ${onlyS1.length}`);
  console.log(` SADECE S2'nin Yakaladığı Özel Tezler  : ${onlyS2.length}`);
  console.log("==========================================================================\n");
}

main().catch((err) => {
  console.error("Test hatası:", err);
  process.exit(1);
});
