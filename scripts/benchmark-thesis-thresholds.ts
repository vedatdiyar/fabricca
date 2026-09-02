/**
 * Thesis-search threshold benchmark — one-off script (no production code change).
 *
 * Measures Cosine score distribution for 6 queries (3 TR + 3 EN equivalents)
 * against Qdrant `theses` collection using L2-normalized e5 embeddings.
 *
 * Env: .env.local -> QDRANT_URL, QDRANT_API_KEY, HUGGINGFACE_API_KEY (or HF_TOKEN/HF_API_KEY)
 * Run: npx tsx scripts/benchmark-thesis-thresholds.ts
 */
import "dotenv/config";
import dotenv from "dotenv";
import path from "path";

// Explicitly load .env.local (dotenv/config loads .env by default)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { QdrantClient } from "@qdrant/js-client-rest";

// Re-use endpoint constant to stay in sync with production code
import { HF_E5_ENDPOINT } from "../src/core/config/endpoints";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------
function requireEnv(name: string, fallbacks: string[] = []): string {
  const val = process.env[name] ?? fallbacks.map((k) => process.env[k]).find(Boolean);
  if (!val) throw new Error(`Missing env: ${name} (tried ${[name, ...fallbacks].join(", ")})`);
  return val;
}

const QDRANT_URL = requireEnv("QDRANT_URL");
const QDRANT_API_KEY = requireEnv("QDRANT_API_KEY");
const HF_API_KEY =
  process.env.HUGGINGFACE_API_KEY ??
  process.env.HF_TOKEN ??
  process.env.HF_API_KEY ??
  "";
if (!HF_API_KEY) throw new Error("Missing env: HUGGINGFACE_API_KEY or HF_TOKEN");

// ---------------------------------------------------------------------------
// L2 normalize (same logic as hf-embedding.ts:22)
// ---------------------------------------------------------------------------
function normalizeL2(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  if (norm === 0 || !Number.isFinite(norm)) return vector;
  return vector.map((v) => v / norm);
}

// ---------------------------------------------------------------------------
// HF embedding fetch (direct, mirrors getE5QueryEmbedding)
// ---------------------------------------------------------------------------
async function fetchE5Embedding(query: string): Promise<number[]> {
  const input = query.trim().startsWith("query: ") ? query.trim() : `query: ${query.trim()}`;
  const res = await fetch(HF_E5_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HF_API_KEY}`,
    },
    body: JSON.stringify({ inputs: [input] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HF ${res.status}: ${txt.slice(0, 800)}`);
  }
  const data = (await res.json()) as unknown;
  let raw: number[];
  if (Array.isArray(data) && Array.isArray((data as unknown[])[0])) raw = (data as number[][])[0];
  else if (Array.isArray(data) && typeof (data as number[])[0] === "number") raw = data as number[];
  else throw new Error(`Unexpected HF response: ${JSON.stringify(data).slice(0, 400)}`);
  return normalizeL2(raw);
}

// ---------------------------------------------------------------------------
// Query groups (3 TR + 3 EN equivalents)
// ---------------------------------------------------------------------------
type QueryGroup = { id: string; lang: "TR" | "EN"; query: string };

const QUERY_GROUPS: QueryGroup[] = [
  { id: "1-TR", lang: "TR", query: "Derin öğrenme ile biyomedikal görüntü işleme" },
  { id: "1-EN", lang: "EN", query: "Deep learning for biomedical image processing" },
  { id: "2-TR", lang: "TR", query: "Osmanlı diplomasi tarihi ve kapitülasyonlar" },
  { id: "2-EN", lang: "EN", query: "Ottoman diplomatic history and capitulations" },
  { id: "3-TR", lang: "TR", query: "Yenilenebilir enerji şebeke entegrasyonu ve kararlılık analizi" },
  { id: "3-EN", lang: "EN", query: "Renewable energy grid integration and stability analysis" },
];

const THRESHOLDS = [0.80, 0.75, 0.70, 0.65] as const;
const FINE_THRESHOLDS = [0.86, 0.85, 0.84, 0.83, 0.82, 0.81] as const;
const BASE_THRESHOLD = 0.5;
const LIMIT = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function countAbove(scores: number[], thr: number): number {
  return scores.filter((s) => s >= thr).length;
}

function truncate(str: string, n: number): string {
  if (!str) return "—";
  const t = str.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  Thesis-Search Benchmark — Cosine Score Distribution (Qdrant + e5)      ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  console.log(`Qdrant : ${QDRANT_URL}`);
  console.log(`HF     : ${HF_E5_ENDPOINT}`);
  console.log(`Limit  : ${LIMIT}, base threshold: ${BASE_THRESHOLD}, thresholds: ${THRESHOLDS.join(", ")}\n`);

  const client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });

  // Quick collection probe
  try {
    const col = await client.getCollection("theses");
    const vec = (col as unknown as { config?: { params?: { vectors?: { size?: number; distance?: string } } } }).config?.params?.vectors;
    console.log(`Collection theses: size=${(vec as unknown as { size?: number })?.size ?? "?"} distance=${(vec as unknown as { distance?: string })?.distance ?? "?"}\n`);
  } catch (e) {
    console.warn(`Collection probe failed: ${(e as Error).message}\n`);
  }

  type Row = {
    id: string;
    lang: string;
    query: string;
    max: number;
    median: number;
    p25: number;
    p75: number;
    total: number;
    c80: number;
    c75: number;
    c70: number;
    c65: number;
    fineCounts: Record<string, number>;
    scores: number[];
    top3: Array<{ score: number; title: string; abstract: string }>;
    error?: string;
  };

  const rows: Row[] = [];

  for (const g of QUERY_GROUPS) {
    process.stdout.write(`→ [${g.id}] "${g.query}"  embedding... `);
    try {
      const embedding = await fetchE5Embedding(g.query);
      const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
      process.stdout.write(`ok (dim=${embedding.length}, L2=${norm.toFixed(4)})  qdrant... `);

      const res = await client.query("theses", {
        query: embedding,
        limit: LIMIT,
        score_threshold: BASE_THRESHOLD,
        with_payload: true,
      });

      const points = (res as unknown as { points: Array<{ score: number; payload?: Record<string, unknown> }> }).points ?? [];
      const scores = points.map((p) => p.score);
      const max = scores.length ? Math.max(...scores) : 0;
      const med = median(scores);

      const top3 = points.slice(0, 3).map((p) => {
        const pl = (p.payload ?? {}) as Record<string, unknown>;
        const title =
          (pl.title_original as string) ??
          (pl.title_translated as string) ??
          (pl.title as string) ??
          (pl.thesisTitle as string) ??
          "—";
        const abs =
          (pl.abstract_original as string) ??
          (pl.abstract as string) ??
          (pl.abstract_translated as string) ??
          "";
        return { score: p.score, title: truncate(String(title), 110), abstract: truncate(String(abs), 180) };
      });

      // Fine-grained threshold histogram (for narrow 0.82-0.87 cluster)
      const fineCounts: Record<string, number> = {};
      for (const ft of FINE_THRESHOLDS) fineCounts[String(ft)] = countAbove(scores, ft);
      const sortedScores = [...scores].sort((a, b) => b - a);
      const p25 = sortedScores[Math.floor(sortedScores.length * 0.25)] ?? 0;
      const p75 = sortedScores[Math.floor(sortedScores.length * 0.75)] ?? 0;

      console.log(`ok (${points.length} hits, max=${max.toFixed(4)})`);

      rows.push({
        id: g.id,
        lang: g.lang,
        query: g.query,
        max,
        median: med,
        p25,
        p75,
        total: points.length,
        c80: countAbove(scores, 0.80),
        c75: countAbove(scores, 0.75),
        c70: countAbove(scores, 0.70),
        c65: countAbove(scores, 0.65),
        fineCounts,
        scores,
        top3,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED: ${msg.slice(0, 200)}`);
      rows.push({
        id: g.id,
        lang: g.lang,
        query: g.query,
        max: 0,
        median: 0,
        p25: 0,
        p75: 0,
        total: 0,
        c80: 0,
        c75: 0,
        c70: 0,
        c65: 0,
        fineCounts: {},
        scores: [],
        top3: [],
        error: msg,
      });
    }
    // small pacing to avoid HF 429
    await new Promise((r) => setTimeout(r, 700));
  }

  // -----------------------------------------------------------------------
  // Table 1 — numeric comparison
  // -----------------------------------------------------------------------
  console.log("\n┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│  TABLO 1 — Skor Dağılımı (limit 20, base 0.5)                                                         │");
  console.log("├────────┬──────┬──────────┬──────────┬──────────┬───────┬──────┬──────┬──────┬──────┤");
  console.log("│ Sorgu  │ Dil  │ Max      │ Median   │ p25/p75  │ n     │ ≥0.80│ ≥0.75│ ≥0.70│ ≥0.65│");
  console.log("├────────┼──────┼──────────┼──────────┼──────────┼───────┼──────┼──────┼──────┼──────┤");
  for (const r of rows) {
    const q = r.id.padEnd(6);
    const lang = r.lang.padEnd(4);
    const max = r.error ? " ERR ".padStart(8) : r.max.toFixed(4).padStart(8);
    const med = r.error ? "  —    ".padStart(8) : r.median.toFixed(4).padStart(8);
    const p2575 = r.error ? "  —      ".padStart(10) : `${r.p25.toFixed(3)}/${r.p75.toFixed(3)}`.padStart(10);
    const n = String(r.total).padStart(5);
    console.log(`│ ${q} │ ${lang} │ ${max} │ ${med} │ ${p2575} │ ${n} │ ${String(r.c80).padStart(4)} │ ${String(r.c75).padStart(4)} │ ${String(r.c70).padStart(4)} │ ${String(r.c65).padStart(4)} │`);
  }
  console.log("└────────┴──────┴──────────┴──────────┴──────────┴───────┴──────┴──────┴──────┴──────┘");
  console.log("\n┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│  TABLO 1b — İnce Eşikler (dar küme 0.81-0.86 — ayırt edici bölge)                                       │");
  console.log("├────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┤");
  console.log("│ Sorgu  │ Dil  │ ≥0.86│ ≥0.85│ ≥0.84│ ≥0.83│ ≥0.82│ ≥0.81│");
  console.log("├────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤");
  for (const r of rows) {
    const q = r.id.padEnd(6);
    const lang = r.lang.padEnd(4);
    if (r.error) { console.log(`│ ${q} │ ${lang} │  ERR │  ERR │  ERR │  ERR │  ERR │  ERR │`); continue; }
    const fc = r.fineCounts;
    console.log(`│ ${q} │ ${lang} │ ${String(fc["0.86"] ?? 0).padStart(4)} │ ${String(fc["0.85"] ?? 0).padStart(4)} │ ${String(fc["0.84"] ?? 0).padStart(4)} │ ${String(fc["0.83"] ?? 0).padStart(4)} │ ${String(fc["0.82"] ?? 0).padStart(4)} │ ${String(fc["0.81"] ?? 0).padStart(4)} │`);
  }
  console.log("└────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘");
  // Optional histogram per query
  console.log("\n  Skor histogram (20 skor, yüksekten düşüğe):");
  for (const r of rows) {
    if (r.error || r.scores.length === 0) continue;
    const line = r.scores.map((s) => s.toFixed(3)).join("  ");
    console.log(`  [${r.id}] ${line}`);
  }

  // -----------------------------------------------------------------------
  // Table 2 — Top-3 semantic fit (manual inspection)
  // -----------------------------------------------------------------------
  console.log("\n┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│  TABLO 2 — İlk 3 Sonuç (başlık + özet kırpılmış) — semantik uygunluk elle kontrol edilsin             │");
  console.log("└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘");
  for (const r of rows) {
    console.log(`\n── [${r.id}] ${r.lang} :: "${r.query}"  (max ${r.max.toFixed(4)}, n=${r.total})${r.error ? "  ⚠ " + r.error.slice(0, 160) : ""}`);
    if (r.top3.length === 0) {
      console.log("   (sonuç yok)");
      continue;
    }
    r.top3.forEach((t, i) => {
      console.log(`   ${i + 1}. [${t.score.toFixed(4)}] ${t.title}`);
      console.log(`      özet: ${t.abstract}`);
    });
  }

  // -----------------------------------------------------------------------
  // Summary stats + recommendation
  // -----------------------------------------------------------------------
  const trRows = rows.filter((r) => r.lang === "TR" && !r.error);
  const enRows = rows.filter((r) => r.lang === "EN" && !r.error);

  function avg(arr: number[]): number {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  console.log("\n┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│  ÖZET — Dil Bazlı Ortalamalar                                                                           │");
  console.log("└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘");
  if (trRows.length) {
    console.log(`TR (n=${trRows.length}): avg max ${avg(trRows.map((r) => r.max)).toFixed(4)}, avg median ${avg(trRows.map((r) => r.median)).toFixed(4)}, avg ≥0.80 ${avg(trRows.map((r) => r.c80)).toFixed(1)}, ≥0.75 ${avg(trRows.map((r) => r.c75)).toFixed(1)}, ≥0.70 ${avg(trRows.map((r) => r.c70)).toFixed(1)}, ≥0.65 ${avg(trRows.map((r) => r.c65)).toFixed(1)}`);
  }
  if (enRows.length) {
    console.log(`EN (n=${enRows.length}): avg max ${avg(enRows.map((r) => r.max)).toFixed(4)}, avg median ${avg(enRows.map((r) => r.median)).toFixed(4)}, avg ≥0.80 ${avg(enRows.map((r) => r.c80)).toFixed(1)}, ≥0.75 ${avg(enRows.map((r) => r.c75)).toFixed(1)}, ≥0.70 ${avg(enRows.map((r) => r.c70)).toFixed(1)}, ≥0.65 ${avg(enRows.map((r) => r.c65)).toFixed(1)}`);
  }

  // Heuristic recommendation
  console.log("\n┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│  ÖNERİ — Optimal score_threshold (Precision/Recall dengesi)                                             │");
  console.log("└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘");

  // Simple rule: pick highest threshold that still keeps avg recall >= 3-5 hits across queries
  function recommend(langRows: Row[]): { thr: number; reason: string } {
    const avgC80 = avg(langRows.map((r) => r.c80));
    const avgC75 = avg(langRows.map((r) => r.c75));
    const avgC70 = avg(langRows.map((r) => r.c70));
    const avgC65 = avg(langRows.map((r) => r.c65));
    const avgMax = avg(langRows.map((r) => r.max));
    if (avgC80 >= 3) return { thr: 0.80, reason: `avg ≥0.80 = ${avgC80.toFixed(1)} hit, max ${avgMax.toFixed(3)} — yüksek precision korunuyor, recall yeterli` };
    if (avgC75 >= 3) return { thr: 0.75, reason: `avg ≥0.80 = ${avgC80.toFixed(1)} düşük, ≥0.75 = ${avgC75.toFixed(1)} hit — 0.75 dengeli` };
    if (avgC70 >= 4) return { thr: 0.70, reason: `≥0.75 recall zayıf (${avgC75.toFixed(1)}), ≥0.70 = ${avgC70.toFixed(1)} hit — 0.70 ile recall kurtarılıyor` };
    if (avgC65 >= 4) return { thr: 0.65, reason: `üst eşikler çok cimri (≥0.70 = ${avgC70.toFixed(1)}), ≥0.65 = ${avgC65.toFixed(1)} hit — 0.65 taban` };
    return { thr: 0.65, reason: `tüm eşikler düşük recall, taban 0.65 önerilir (avg max ${avgMax.toFixed(3)})` };
  }

  if (trRows.length) {
    const rec = recommend(trRows);
    console.log(`TR → ${rec.thr.toFixed(2)}  — ${rec.reason}`);
  }
  if (enRows.length) {
    const rec = recommend(enRows);
    console.log(`EN → ${rec.thr.toFixed(2)}  — ${rec.reason}`);
  }
  if (trRows.length && enRows.length) {
    const trRec = recommend(trRows).thr;
    const enRec = recommend(enRows).thr;
    if (trRec === enRec) console.log(`\n→ Tek eşik yeterli: ${trRec.toFixed(2)} (TR ve EN aynı)`);
    else console.log(`\n→ Dil-bazlı ayrım önerilir: TR ${trRec.toFixed(2)} / EN ${enRec.toFixed(2)} — EN sorgularda e5 skorları tipik olarak biraz düşük seyreder`);
  }

  console.log("\nNot: İlk 3 başlık/özetleri Tablo 2'de gözle doğrula — skor yüksek ama konu sapması varsa eşiği yükselt; skor düşük ama konu isabetliyse eşiği düşür.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
