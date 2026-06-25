/**
 * Embedding Resolver — Rezerve vektör tabanlı yardımcı modülü.
 *
 * Bu dosya, eski Cloudflare embedding tabanlı sifting mekanizmasının
 * fonksiyonlarını muhafaza eder. Şu an production akışında
 * kullanılmamaktadır (yerini LLM sifting almıştır).
 *
 * İleride kaynak yükleme, PDF gömme veya RAG tabanlı arama
 * senaryolarında ihtiyaç duyulursa buradan import edilerek
 * aktifleştirilebilir.
 */

export { generateEmbeddings } from "@/lib/cloudflare";
export { cosineSimilarity } from "@/lib/math/vector";
