// tests/test-logger.ts
import { Logger, createFlowId } from "../src/lib/logger";

async function runMockPipeline() {
  const mockFlowId = createFlowId();
  const logger = new Logger(mockFlowId);

  console.log("\n=== 🚀 FABRICCA CENTRAL LOGGER TEST RUNNER ===\n");

  // 1. MODÜL: MATRİS ZENGİNLEŞTİRME TESTİ
  logger.info("matrix_enrichment_start", {
    service: "matrix",
    data: { context: "Tez Matrisi Zenginleştirme Adımı" },
  });

  // Yapay zeka istek simülasyonu
  logger.info("ai_request_start", {
    service: "gemini",
    data: { thinkingLevel: "LOW", model: "gemini-3.1-flash-lite" },
  });

  await new Promise((r) => setTimeout(r, 400)); // Yapay zeka bekliyor gibi yapalım

  logger.info("ai_request_success", {
    service: "gemini",
    durationMs: 420,
    tokens: { input: 1200, output: 450, total: 1650 },
    data: { model: "gemini-3.1-flash-lite" },
  });

  logger.info("matrix_enrichment_success", {
    service: "matrix",
    durationMs: 450,
    data: { count: 1, context: "Tez Matrisi Başarıyla Güncellendi" },
  });

  console.log(
    "\n--------------------------------------------------------------------------------\n",
  );

  // 2. MODÜL: PARALEL LİTERATÜR TARAMA TESTİ (Kutu 1 ve Kutu 2 Aynı Anda)
  const ctxKutu1 = "Kutu 1: Çerçeveleme Teorisi";
  const ctxKutu2 = "Kutu 2: Gramscici Hegemonya";

  // İki kutu aynı anda aramaya başlıyor (Mükerrerlik koruması devrede)
  logger.info("literature_search_start", {
    service: "literature",
    data: { context: ctxKutu1 },
  });
  logger.info("literature_search_start", {
    service: "literature",
    data: { context: ctxKutu2 },
  });

  // Kutu 1 aramayı bitiriyor
  logger.info("literature_search_done", {
    service: "literature",
    status: "SUCCESS",
    durationMs: 85,
    data: { resultCount: 45, context: ctxKutu1 },
  });

  // Kutu 1 için Sifting (Eleme) Başlıyor
  logger.info("literature_sifting_done", {
    service: "literature",
    status: "SUCCESS",
    durationMs: 1200,
    data: { before: 45, after: 44, context: ctxKutu1 },
  });

  // O sırada Kutu 2 aramayı bitiriyor
  logger.info("literature_search_done", {
    service: "literature",
    status: "SUCCESS",
    durationMs: 320,
    data: { resultCount: 48, context: ctxKutu2 },
  });

  // Kutu 1 Jüriye giriyor ve CrossRef doğrulaması bitiyor
  logger.info("literature_jury_done", {
    service: "literature",
    status: "SUCCESS",
    durationMs: 850,
    data: { count: 4, resultCount: 15, context: ctxKutu1 },
  });

  logger.info("literature_crossref_done", {
    service: "literature",
    status: "SUCCESS",
    durationMs: 150,
    data: { resultCount: 19, context: ctxKutu1 },
  });

  // 3. MODÜL: HATA DURUMU SİMÜLASYONU
  logger.error("matrix_save_failed", {
    service: "matrix",
    error: new Error(
      "Drizzle Transaction Timeout: Veritabanı bağlantı sınırına ulaşıldı.",
    ),
    data: { context: "Matris Kaydedilirken Hata Oluştu" },
  });

  console.log("\n=== 🏁 TEST RUNNER TAMAMLANDI ===\n");
}

runMockPipeline();
