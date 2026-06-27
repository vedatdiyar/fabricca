/**
 * Integration test for mineCoCitations — validates isolated-per-query champion
 * selection (no cross-contamination) against the live OpenAlex API.
 *
 * V2 — adds a supplementary Top‑5 candidate pool analysis via direct OpenAlex
 * calls to let us inspect the raw frequency distribution below the champion.
 *
 * Run from project root:
 *   npx tsx src/app/\(auth\)/onboarding/_services/__tests__/mine-co-citations.integration.ts
 *
 * Constraints:
 *   - No mocking (jest.mock / vi.mock) — every fetch hits the real OpenAlex API.
 *   - No modification to existing source files.
 *   - Zero new package dependencies (tsx + dotenv already in devDependencies).
 */

import dotenv from "dotenv";
import { mineCoCitations } from "../co-citation-miner";
import { Logger, createFlowId } from "@/lib/logger";
import type { FoundationalQuery } from "@/lib/types";

// ==================================================================
// Phase 0: Env & Setup
// ==================================================================

dotenv.config({ path: ".env.local" });

if (!process.env.OPENALEX_API_KEY) {
  console.error("FATAL: OPENALEX_API_KEY not found in .env.local");
  process.exit(1);
}

if (!process.env.NODE_ENV)
  (process.env as Record<string, string>).NODE_ENV = "production";

const LOG = new Logger(createFlowId());

const OPENALEX_USER_AGENT =
  "FabriccaAcademicAssistant/1.0 (mailto:support@fabricca.com)";
const OPENALEX_DELAY_MS = 1100;

// ==================================================================
// Query Pool — condensed / hybrid queries
// ==================================================================

const QUERIES: string[] = [
  // Q1: Saf Gramsci hücresi — no Snow/framing mention
  "This study investigates the theoretical frameworks of Antonio Gramsci, focusing on his concepts of cultural hegemony, war of position, and passive revolution to understand how political movements construct ideological frontiers.",

  // Q2: Saf David Snow / Framing hücresi — no Gramsci/hegemony mention
  "Drawing upon the collective action frames literature initiated by David Snow and Robert Benford, this research examines the mechanisms of frame alignment and strategic discursive construction that allow political actors to mobilize support bases.",

  // Q3: Metodoloji — condensed hybrid (unchanged from V3)
  "This methodological framework utilizes qualitative historical comparative discourse analysis, applying systemic framing coding and archival research protocols to analyze textual data.",
];

const LABELS: string[] = [
  "Gramsci (Saf Hücre)",
  "David Snow / Framing (Saf Hücre)",
  "Metodoloji (Yoğunlaştırılmış)",
];

// ==================================================================
// OpenAlex response types (no `any`)
// ==================================================================

interface OpenAlexSearchHit {
  id: string;
  title?: string;
  referenced_works?: string[];
}

interface OpenAlexSearchResponse {
  results?: OpenAlexSearchHit[];
}

interface OpenAlexAuthorEntry {
  author?: {
    display_name?: string;
  };
}

interface OpenAlexDetailHit {
  id: string;
  title?: string;
  publication_year?: number;
  authorships?: OpenAlexAuthorEntry[];
}

interface OpenAlexDetailResponse {
  results?: OpenAlexDetailHit[];
}

// ==================================================================
// Console Interceptor
// ==================================================================

const captured: string[] = [];

const _origLog = console.log.bind(console);
const _origWarn = console.warn.bind(console);
const _origError = console.error.bind(console);

function interceptConsole(): void {
  console.log = (...args: unknown[]) => {
    captured.push(args.join(" "));
    _origLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    captured.push(args.join(" "));
    _origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    captured.push(args.join(" "));
    _origError(...args);
  };
}

function restoreConsole(): void {
  console.log = _origLog;
  console.warn = _origWarn;
  console.error = _origError;
}

// ==================================================================
// Helpers
// ==================================================================

const fmtDur = (ms: number): string => `${(ms / 1000).toFixed(1)} sn`;
const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

function extractScore(queryIndex: number): string {
  for (const line of captured) {
    try {
      const obj = JSON.parse(line);
      if (
        obj.event === "co_citation_miner_champion_selected" &&
        obj.data?.queryIndex === queryIndex
      ) {
        return String(obj.data.champion?.score ?? "?");
      }
    } catch {
      // not JSON
    }
  }
  return "?";
}

// ==================================================================
// Supplementary Top‑5 analysis via direct OpenAlex calls
// (mirrors the miner's Step‑1‑to‑Step‑5 pipeline for inspection)
// ==================================================================

interface TopCandidate {
  title: string;
  authors: string[];
  year: number;
  localCount: number;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) return res;
      if (attempt < retries) await delay(1500 * Math.pow(2, attempt));
    } catch {
      if (attempt >= retries) return null;
      await delay(1500 * Math.pow(2, attempt));
    }
  }
  return null;
}

async function fetchTopCandidates(
  query: string,
  apiKey: string | undefined,
): Promise<TopCandidate[]> {
  const freqMap = new Map<string, number>();

  // Step 1 — semantic search, harvest referenced_works frequencies
  const searchParams = new URLSearchParams({
    "search.semantic": query,
    per_page: "50",
    select: "id,title,referenced_works",
  });
  if (apiKey) searchParams.set("api_key", apiKey);

  const searchUrl = `https://api.openalex.org/works?${searchParams.toString().replace(/\+/g, "%20")}`;
  const searchRes = await fetchWithRetry(searchUrl, {
    headers: { "User-Agent": OPENALEX_USER_AGENT },
  });

  if (!searchRes) return [];

  const searchData = (await searchRes.json()) as OpenAlexSearchResponse;
  for (const item of searchData.results ?? []) {
    for (const ref of item.referenced_works ?? []) {
      if (ref) freqMap.set(ref, (freqMap.get(ref) || 0) + 1);
    }
  }

  // Step 2 — sort & take top 20
  const sorted = Array.from(freqMap.entries())
    .map(([id, localCount]) => ({ id, localCount }))
    .sort((a, b) => b.localCount - a.localCount)
    .slice(0, 20);

  if (sorted.length === 0) return [];

  // Throttle before detail fetch
  await delay(OPENALEX_DELAY_MS);

  // Step 3 — batch-metadata for the 20 strongest candidates
  const ids = sorted.map((c) => c.id.replace("https://openalex.org/", ""));
  const detailParams = new URLSearchParams({
    filter: `openalex_id:${ids.join("|")}`,
    select: "id,title,authorships,publication_year",
  });
  if (apiKey) detailParams.set("api_key", apiKey);

  const detailUrl = `https://api.openalex.org/works?${detailParams.toString().replace(/\+/g, "%20")}`;
  const detailRes = await fetchWithRetry(detailUrl, {
    headers: { "User-Agent": OPENALEX_USER_AGENT },
  });

  if (!detailRes) return [];

  const detailData = (await detailRes.json()) as OpenAlexDetailResponse;

  // Step 4 — map frequencies onto detailed records & sort
  const countById = new Map(sorted.map((c) => [c.id, c.localCount]));
  const candidates: TopCandidate[] = [];

  for (const hit of detailData.results ?? []) {
    const localCount = countById.get(hit.id) ?? 0;
    if (localCount === 0) continue;

    candidates.push({
      title: hit.title ?? "Unknown",
      authors:
        hit.authorships
          ?.map((a) => a.author?.display_name ?? "")
          .filter(Boolean) ?? [],
      year: hit.publication_year ?? 0,
      localCount,
    });
  }

  candidates.sort((a, b) => b.localCount - a.localCount);
  return candidates.slice(0, 5);
}

// ==================================================================
// Report Renderer
// ==================================================================

interface IsolatedEntry {
  label: string;
  durationMs: number;
  champion: FoundationalQuery | null;
}

function fmtAuthor(authors: string[]): string {
  return authors.length > 2 ? `${authors[0]} et al.` : authors.join(" & ");
}

function renderReport(
  totalMs: number,
  isolated: IsolatedEntry[],
  batchMs: number,
  batchChamps: FoundationalQuery[],
  crossAnalysis: { verdict: "TEMİZ" | "ÇAPRAZ KİRLENME"; detail?: string }[],
  topFive: { label: string; candidates: TopCandidate[] }[],
  network: { has429: boolean; hasTimeout: boolean },
): void {
  const W = 78;
  const S = "║";
  const T = "═";

  const L = (s: string) => console.log(`${S} ${s.padEnd(W - 2)} ${S}`);
  const sep = () => console.log(`╠${T.repeat(W)}╣`);

  const titleMax = W - 28;

  // ── Top border ──
  console.log(`╔${T.repeat(W)}╗`);
  L("CO-CITATION MINER INTEGRATION TEST — V3 (TOP 3 PER QUERY)");
  L("");
  L(`Toplam Süre: ${fmtDur(totalMs)}`);
  L(
    `429 Hata: ${network.has429 ? "⚠️ VAR" : "Yok"}   |   Timeout: ${network.hasTimeout ? "⚠️ VAR" : "Yok"}`,
  );
  sep();

  // ── Isolated calls — top 3 from supplementary analysis ──
  L("İZOLE ÇAĞRILAR");
  L("");
  for (let i = 0; i < isolated.length; i++) {
    const t5 = topFive[i];
    const r = isolated[i];
    L(`Sorgu #${i + 1} — ${r.label} → ${fmtDur(r.durationMs)}`);
    if (t5.candidates.length === 0) {
      L(`  ⚠️ Hiç aday bulunamadı`);
    } else {
      const top3 = t5.candidates.slice(0, 3);
      for (let j = 0; j < top3.length; j++) {
        const c = top3[j];
        const authorStr = fmtAuthor(c.authors);
        const titleLine = `${j + 1}. Kurucu Eser: ${c.title.length > titleMax ? c.title.slice(0, titleMax - 3) + "..." : c.title}`;
        L(titleLine);
        L(`   ${authorStr} (${c.year}) -> localCount: ${c.localCount}`);
      }
    }
    if (i < isolated.length - 1) L(`  ${"─".repeat(W - 4)}`);
  }
  sep();

  // ── Batch call (miner's champions) ──
  L("TOPLU ÇAĞRI (Miner Champions — Cross-Contamination Check)");
  L(`  Süre: ${fmtDur(batchMs)}`);
  L("");
  for (let i = 0; i < batchChamps.length; i++) {
    const c = batchChamps[i];
    L(`  Sorgu #${i + 1} — ${LABELS[i]}`);
    L(`    Şampiyon: "${c.title}"`);
    L(`    ${c.author} (${c.publicationYear})`);
  }
  sep();

  // ── Cross-contamination analysis ──
  L("ÇAPRAZ ETKİ ANALİZİ");
  L("");
  for (let i = 0; i < crossAnalysis.length; i++) {
    const ca = crossAnalysis[i];
    const icon = ca.verdict === "TEMİZ" ? "✅" : "❌";
    L(`  ${icon} ${LABELS[i].padEnd(W - 10)} ${ca.verdict}`);
    if (ca.detail) L(`     ${ca.detail}`);
  }

  // ── Bottom border ──
  console.log(`╚${T.repeat(W)}╝`);
}

// ==================================================================
// Main
// ==================================================================

async function main(): Promise<void> {
  const t0 = performance.now();
  interceptConsole();

  try {
    // ------------------------------------------------------------------
    // Phase S — Supplementary Top‑5 analysis (direct OpenAlex calls)
    // ------------------------------------------------------------------

    console.log("\n=== SUPPL: Top 5 Candidate Pool Analysis ===\n");

    const apiKey = process.env.OPENALEX_API_KEY;
    const topFive: { label: string; candidates: TopCandidate[] }[] = [];

    for (let i = 0; i < QUERIES.length; i++) {
      console.log(`Fetching top candidates for query #${i + 1}...`);
      const candidates = await fetchTopCandidates(QUERIES[i], apiKey);
      topFive.push({ label: LABELS[i], candidates });
      if (i < QUERIES.length - 1) await delay(OPENALEX_DELAY_MS);
    }

    // ------------------------------------------------------------------
    // Phase 1 — Isolated calls
    // ------------------------------------------------------------------

    console.log("\n=== FAZ 1: İzole Çağrılar ===\n");

    const isolated: IsolatedEntry[] = [];

    for (let i = 0; i < QUERIES.length; i++) {
      const qStart = performance.now();
      const result = await mineCoCitations([QUERIES[i]], LOG);
      isolated.push({
        label: LABELS[i],
        durationMs: performance.now() - qStart,
        champion: result.length > 0 ? result[0] : null,
      });
    }

    // ------------------------------------------------------------------
    // Phase 2 — Batch call
    // ------------------------------------------------------------------

    console.log("\n=== FAZ 2: Toplu Çağrı ===\n");

    const bStart = performance.now();
    const batchChamps = await mineCoCitations(QUERIES, LOG);
    const batchMs = performance.now() - bStart;

    // ------------------------------------------------------------------
    // Phase 3 — Cross-contamination analysis
    // ------------------------------------------------------------------

    console.log("\n=== FAZ 3: Çapraz Etki Analizi ===\n");

    const crossAnalysis: {
      verdict: "TEMİZ" | "ÇAPRAZ KİRLENME";
      detail?: string;
    }[] = [];

    for (let i = 0; i < QUERIES.length; i++) {
      const iso = isolated[i].champion;
      const bat = batchChamps[i] ?? null;

      if (iso === null && bat === null) {
        crossAnalysis.push({ verdict: "TEMİZ" });
      } else if (iso !== null && bat !== null) {
        const keyIso = `${iso.author}|${iso.title}`.toLowerCase().trim();
        const keyBat = `${bat.author}|${bat.title}`.toLowerCase().trim();
        crossAnalysis.push({
          verdict: keyIso === keyBat ? "TEMİZ" : "ÇAPRAZ KİRLENME",
          detail:
            keyIso !== keyBat
              ? `izole: "${iso.title}" ≠ toplu: "${bat.title}"`
              : undefined,
        });
      } else {
        crossAnalysis.push({
          verdict: "ÇAPRAZ KİRLENME",
          detail: `izole: ${iso ? "seçildi" : "seçilemedi"}, toplu: ${bat ? "seçildi" : "seçilemedi"}`,
        });
      }
    }

    // ------------------------------------------------------------------
    // Phase 4 — Network health check
    // ------------------------------------------------------------------

    const allLogs = captured.join("\n").toLowerCase();
    const network = {
      has429: /\b429\b|too many requests/i.test(allLogs),
      hasTimeout: /\btimeout\b|aborterror|abort/i.test(allLogs),
    };

    restoreConsole();

    // ------------------------------------------------------------------
    // Final Report
    // ------------------------------------------------------------------

    const totalMs = performance.now() - t0;
    renderReport(
      totalMs,
      isolated,
      batchMs,
      batchChamps,
      crossAnalysis,
      topFive,
      network,
    );

    const allClean = crossAnalysis.every((ca) => ca.verdict === "TEMİZ");
    if (allClean && !network.has429 && !network.hasTimeout) {
      console.log(
        "\n✅ ALL CHECKS PASSED — no cross-contamination, no network errors.",
      );
    } else {
      console.log("\n⚠️  Some checks did NOT pass — review the report above.");
    }
  } catch (err) {
    restoreConsole();
    console.error("\n❌ Test crashed with an unhandled exception:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
