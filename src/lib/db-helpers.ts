/**
 * Veri tabanı işlemleri için merkezi hata yönetimi ve loglama yardımcısı.
 *
 * Tüm action dosyalarındaki tekrarlanan try/catch/log kalıbını teke indirir.
 * Her DB işlemini db_start / db_success / db_failed olaylarıyla
 * yapılandırılmış JSON loga yazar ve hata durumunda yeniden fırlatır.
 *
 * @example
 *   const result = await withDbLogging(
 *     () => db.select().from(thesisMatrices).where(eq(thesisMatrices.userId, userId)),
 *     "read_matrix",
 *     log,
 *   );
 */

import type { Logger } from "@/lib/logger";

export async function withDbLogging<T>(
  dbOperation: () => Promise<T>,
  step: string,
  logger: Logger,
): Promise<T> {
  const start = performance.now();
  logger.info("db_start", { service: "db", step });
  try {
    const result = await dbOperation();
    logger.info("db_success", {
      service: "db",
      step,
      durationMs: performance.now() - start,
    });
    return result;
  } catch (dbError) {
    logger.error("db_failed", {
      service: "db",
      step,
      durationMs: performance.now() - start,
      error: dbError,
    });
    throw dbError;
  }
}
