import { getE5QueryEmbedding, searchTezara } from "../src/features/tezara";

interface BenchmarkResult {
  query: string;
  category: string;
  embeddingTimeMs: number;
  dbSearchTimeMs: number;
  totalTimeMs: number;
  resultsCount: number;
  topTitles: string[];
  hasAbstractCount: number;
  hasPdfCount: number;
}

const TEST_QUERIES = [
  {
    category: "Hukuk & Teknoloji",
    query: "yapay zeka üretimi eserlerin telif hakkı ve fikri mülkiyet koruması",
  },
  {
    category: "Sosyoloji & Göç",
    query: "suriyeli sığınmacıların kentsel entegrasyonu ve mekansal ayrışma",
  },
  {
    category: "Ekonomi & Finans",
    query: "merkez bankası faiz kararlarının enflasyon ve döviz kuru üzerindeki dinamik etkileri",
  },
  {
    category: "Tıp & Biyoteknoloji",
    query: "meme kanseri erken teşhisinde derin öğrenme ve konvolüsyonel sinir ağları",
  },
  {
    category: "Eğitim Bilimleri",
    query: "ortaokul öğrencilerinde uzaktan eğitim sürecinde matematik kaygısı ve akademik başarı",
  },
  {
    category: "İngilizce Sorgu (Multilingual Test)",
    query: "corporate governance board gender diversity and financial performance",
  },
];

async function runBenchmark() {
  console.log("===============================================================");
  console.log("   FABRICCA - TURSO VEKTÖR & HUGGING FACE KALİTE/PERFORMANS TESTİ   ");
  console.log("===============================================================\n");

  const benchmarkResults: BenchmarkResult[] = [];

  for (const item of TEST_QUERIES) {
    console.log(`[TEST BAŞLADI] Kategori: ${item.category}`);
    console.log(`Sorgu: "${item.query}"`);

    // 1. Embedding süresi
    const embStart = performance.now();
    const emb = await getE5QueryEmbedding(item.query);
    const embTime = Math.round(performance.now() - embStart);

    // 2. Arama ve E2E süresi
    const totalStart = performance.now();
    const results = await searchTezara(item.query, undefined, { limit: 10 });
    const totalTime = Math.round(performance.now() - totalStart);
    const dbTime = Math.max(0, totalTime - embTime);

    const hasAbstract = results.filter((r) => r.abstract && r.abstract.length > 50).length;
    const hasPdf = results.filter((r) => Boolean(r.yokPdfUrl)).length;

    benchmarkResults.push({
      query: item.query,
      category: item.category,
      embeddingTimeMs: embTime,
      dbSearchTimeMs: dbTime,
      totalTimeMs: totalTime,
      resultsCount: results.length,
      topTitles: results.slice(0, 3).map((r) => `[${r.year}] ${r.title} (${r.author} - ${r.university})`),
      hasAbstractCount: hasAbstract,
      hasPdfCount: hasPdf,
    });

    console.log(`  ⏱️ Embedding: ${embTime}ms | DB Arama: ${dbTime}ms | Toplam: ${totalTime}ms`);
    console.log(`  📊 Dönen Tez Sayısı: ${results.length} | Özet Doluluğu: %${(hasAbstract / results.length) * 100} | PDF Oranı: %${(hasPdf / results.length) * 100}`);
    console.log(`  🎯 İlk 2 Sonuç:`);
    results.slice(0, 2).forEach((r, idx) => {
      console.log(`     ${idx + 1}. [${r.year}] ${r.title.slice(0, 90)}...`);
      console.log(`        Yazar: ${r.author} | Ünv: ${r.university} | Dil: ${r.language || "N/A"}`);
      console.log(`        Özet: ${r.abstract.slice(0, 110)}...\n`);
    });
    console.log("---------------------------------------------------------------");
  }

  // 3. Paralel İstek / Çoklu Sorgu Testi (Positioning sifting simülasyonu: 8 sorgu)
  console.log("\n[PARALEL SORGULAMA TESTİ - Sifting Simülasyonu]");
  console.log("8 eşzamanlı/sıralı sorgu yükü testi yapılıyor...");
  const multiStart = performance.now();
  const multiPromises = TEST_QUERIES.map((t) => searchTezara(t.query, undefined, { limit: 20 }));
  const multiRes = await Promise.all(multiPromises);
  const multiDuration = Math.round(performance.now() - multiStart);
  const totalThesesFetched = multiRes.reduce((acc, curr) => acc + curr.length, 0);

  console.log(`  ⏱️ 6 Paralel Sorgu Tamamlanma Süresi: ${multiDuration}ms`);
  console.log(`  📦 Toplam Çekilen Tez: ${totalThesesFetched}`);
  console.log(`  ⚡ Ortalama Sorgu Başına Süre (Throughput): ${(multiDuration / 6).toFixed(1)}ms`);

  // İstatistikler
  const avgTotal = Math.round(
    benchmarkResults.reduce((a, b) => a + b.totalTimeMs, 0) / benchmarkResults.length,
  );
  const avgEmb = Math.round(
    benchmarkResults.reduce((a, b) => a + b.embeddingTimeMs, 0) / benchmarkResults.length,
  );
  const avgDb = Math.round(
    benchmarkResults.reduce((a, b) => a + b.dbSearchTimeMs, 0) / benchmarkResults.length,
  );

  console.log("\n===============================================================");
  console.log("                     GENEL PERFORMANS RAPORU                   ");
  console.log("===============================================================");
  console.log(` Ort. Embedding Süresi (Hugging Face) : ${avgEmb} ms`);
  console.log(` Ort. Veritabanı Arama Süresi (Turso) : ${avgDb} ms`);
  console.log(` Ort. Toplam İstek Süresi (E2E)        : ${avgTotal} ms`);
  console.log(` Paralel 6 Sorgu Çekim Süresi         : ${multiDuration} ms`);
  console.log("===============================================================\n");
}

runBenchmark().catch((err) => {
  console.error("Benchmark testinde hata oluştu:", err);
  process.exit(1);
});
