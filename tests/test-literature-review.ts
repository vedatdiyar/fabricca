/**
 * Literatür Taraması (Literature Review) Pipeline Test
 *
 * Bu script, "Gramscici Hegemonya Kuramı ve Söylem" konu kutusu için
 * 7 aşamalı literatür tarama pipeline'ını uçtan uca test eder:
 *   1. Kurucu Eser Çözümleme → OpenAlex API
 *   2. Semantik Arama → OpenAlex API
 *   3. Birleştirme / Deduplikasyon
 *   4. AI Eleme (Sifting) → Gemini LOW Thinking
 *   5. Özet Kurtarma (Abstract Recovery) → OpenAlex API
 *   6. AI Jüri Analizi → Gemini HIGH Thinking
 *   7. CrossRef Doğrulama (Polite Pool)
 *
 * Kullanım:
 *   npx tsx tests/test-literature-review.ts
 *
 * Gereksinimler:
 *   - .env.local dosyasında GEMINI_API_KEY, OPENALEX_API_KEY, CROSSREF_CONTACT_EMAIL tanımlı olmalıdır
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Logger, createFlowId } from "../src/lib/logger";
import type { FoundationalQuery, JuryArticle } from "../src/lib/types";
import type {
  SubBoxInput,
  ValidatedPaper,
} from "../src/app/(auth)/onboarding/literature-review/_services/literature-review-papers";
import { mergePapers } from "../src/app/(auth)/onboarding/literature-review/_services/literature-review-papers";
import {
  searchOpenAlex,
  resolveFoundationalWorks,
  fetchFullAbstracts,
} from "../src/app/(auth)/onboarding/literature-review/_services/search-api";
import {
  runSiftingStage,
  runJuryStage,
  enrichJuryArticleWithCrossRef,
  type LiteratureReviewResult,
} from "../src/app/(auth)/onboarding/literature-review/_services/ai-processor";

// ============================================================================
// GIRDI VERILERI
// ============================================================================

const subBox: SubBoxInput = {
  title: "Post-Yapısalcı Söylem Teorisi ve Radikal Demokrasi",
  description:
    "Marksist sınıf indirgemeciliğinin eleştirisi üzerinden, toplumsal alanın söylemsel inşasını, antagonizma kavramını ve hegemonik eklemlenme pratiklerini post-yapısalcı ve psikanalitik (Lacanian) perspektiften inceleyen kuramsal çerçeve.",
  semanticSearchBlock:
    "Post-Marxist discourse theory and radical democracy challenge economic determinism by introducing social antagonism, empty signifiers, and discursive articulation. Integrating Lacanian psychoanalysis with post-structuralism, this framework analyzes how political identities are contingently constructed through chains of equivalence and difference.",
  foundationalQueries: [
    {
      title:
        "Hegemony and Socialist Strategy: Towards a Radical Democratic Politics",
      author: "Ernesto Laclau and Chantal Mouffe",
      publicationYear: 1985,
    },
    {
      title: "The Sublime Object of Ideology",
      author: "Slavoj Žižek",
      publicationYear: 1989,
    },
  ],
};

const thesisCtx = {
  studyTitle:
    "Söylem, Kimlik ve Radikal Demokrasi: Türkiye'de Yeni Toplumsal Hareketlerin Hegemonik İnşa Süreçleri ve Kimlik Dönüşümleri",
  researchQuestion:
    "2000'li yıllar sonrasında Türkiye'deki yeni toplumsal hareketler (çevre, toplumsal cinsiyet ve anti-kapitalist oluşumlar) sınıf merkezli olmayan yeni kimlik siyasetlerini söylemsel olarak nasıl inşa etmişlerdir; bu kimliklerin hegemonik eklemlenme süreçleri radikal demokrasi perspektifinden nasıl anlamlandırılabilir?",
  theoreticalFramework:
    "Birincil kuramsal çerçeve: Laclau ve Mouffe'un Essex Okulu söylem teorisi (antagonizma, boş gösteren, eşdeğerlik zinciri). İkincil kuramsal çerçeve: Žižekçi ve Lacancı ideoloji eleştirisi (arzunun nesnesi, fantezi, toplumsal bölünme).",
  historicalLimits: "2000–2025 arası dönem.",
  spatialLimits: "Türkiye tabanlı toplumsal hareketler ve kuramsal adaptasyon.",
};

// ============================================================================
// SABITLER
// ============================================================================
const CROSSREF_CONCURRENCY = 5;
const DIVIDER =
  "\n──────────────────────────────────────────────────────────────────────────────\n";

// ============================================================================
// DIAGNOSTIC: OpenAlex Semantic Search — Full Visibility Wrapper
// ============================================================================

const DIAG_STOP_WORDS = new Set([
  "bir",
  "bu",
  "ile",
  "ve",
  "veya",
  "için",
  "olarak",
  "olan",
  "the",
  "a",
  "an",
  "and",
  "or",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "is",
  "it",
  "as",
  "be",
  "are",
  "was",
  "were",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "can",
  "may",
  "could",
  "should",
  "its",
  "all",
  "each",
  "every",
  "some",
  "any",
  "no",
  "not",
  "only",
  "this",
  "that",
  "these",
  "those",
  "from",
  "into",
  "through",
  "over",
  "under",
]);

function diagExtractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşüâêîôû]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !DIAG_STOP_WORDS.has(w));
}

/**
 * Wraps searchOpenAlex with pre-request URL diagnostics, raw response
 * introspection, and per-stage filter step analysis — without modifying
 * any source code under src/.
 */
async function diagnosticSearchOpenAlex(
  semanticQuery: string,
): Promise<Awaited<ReturnType<typeof searchOpenAlex>>> {
  // ── 1) Pre-request: URL X-Ray ──────────────────────────────────────────
  const apiKey = process.env.OPENALEX_API_KEY;
  const params = new URLSearchParams({
    "search.semantic": semanticQuery,
    filter: "has_abstract:true",
    per_page: "50",
    select:
      "id,title,type,biblio,abstract_inverted_index,cited_by_count,relevance_score,authorships,publication_year,primary_location",
  });
  if (apiKey) params.set("api_key", apiKey);

  console.log("\n  ┌─ DIAG: İSTEK ÖNCESİ URL RÖNTGENİ ──────────────────────");
  console.log(`  │  Nihai OpenAlex URL:`);
  console.log(`  │  https://api.openalex.org/works?${params.toString()}`);
  console.log(`  │`);
  console.log(`  │  Sorgu Parametreleri (tek tek):`);
  for (const [k, v] of params.entries()) {
    console.log(
      `  │    ${k.padEnd(25)} = ${v.slice(0, 120)}${v.length > 120 ? "…" : ""}`,
    );
  }
  console.log(`  └${"─".repeat(57)}`);

  // ── 2) Raw response: bypass parseOpenAlexResults ──────────────────────
  console.log(
    `\n  ┌─ DIAG: HAM API CEVABI (RAW FETCH) ───────────────────────`,
  );
  let rawResponseMeta: { count: number; results: Record<string, unknown>[] } = {
    count: 0,
    results: [],
  };

  try {
    const rawUrl = `https://api.openalex.org/works?${params.toString()}`;
    const rawRes = await fetch(rawUrl, {
      headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (rawRes.ok) {
      const rawJson = (await rawRes.json()) as {
        meta?: { count?: number };
        results?: Record<string, unknown>[];
      };
      const metaCount = rawJson.meta?.count ?? 0;
      const rawResults = rawJson.results ?? [];
      rawResponseMeta = { count: metaCount, results: rawResults };

      console.log(`  │`);
      console.log(`  │  meta.count (toplam eser)  : ${metaCount}`);
      console.log(`  │  Dönen nesne sayısı         : ${rawResults.length}`);
      console.log(`  │`);
      console.log(`  │  İlk 3 Ham Obje (haritalama/filtre ÖNCESİ):`);
      for (let i = 0; i < Math.min(3, rawResults.length); i++) {
        const r = rawResults[i];
        console.log(`  │`);
        console.log(`  │  ── Obje #${i + 1} ────────────────────────────────`);
        console.log(`  │  id             : ${(r.id as string) ?? "—"}`);
        console.log(
          `  │  title          : ${(r.title as string)?.slice(0, 120) ?? "—"}`,
        );
        console.log(`  │  type           : ${(r.type as string) ?? "—"}`);
        console.log(
          `  │  relevance_score: ${(r.relevance_score as number)?.toFixed(4) ?? "—"}`,
        );
        console.log(
          `  │  cited_by_count : ${(r.cited_by_count as number) ?? "—"}`,
        );
        console.log(
          `  │  publication_yr : ${(r.publication_year as number) ?? "—"}`,
        );
        const au = r.authorships as
          | { author?: { display_name?: string } }[]
          | undefined;
        console.log(`  │  authorships    : ${au?.length ?? 0} yazar`);
        console.log(
          `  │  has_primary_loc: ${r.primary_location ? "evet" : "hayır"}`,
        );
        const biblio = r.biblio as Record<string, unknown> | undefined;
        if (biblio) {
          console.log(`  │  biblio.first_pg: ${biblio.first_page ?? "—"}`);
          console.log(`  │  biblio.last_pg : ${biblio.last_page ?? "—"}`);
        }
        const idx = r.abstract_inverted_index as
          | Record<string, unknown>
          | undefined;
        console.log(
          `  │  abstract_word_count: ${idx ? Object.keys(idx).length : 0}`,
        );
        const doi = r.doi as string | undefined;
        console.log(`  │  doi            : ${doi ?? "—"}`);
      }
    } else {
      console.log(`  │  ⚠️  Raw fetch başarısız — HTTP ${rawRes.status}`);
    }
  } catch (err) {
    console.log(
      `  │  ⚠️  Raw fetch exception: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  console.log(`  └${"─".repeat(57)}`);

  // ── 3) Simulate per-stage filter counts ──────────────────────────────
  console.log(`\n  ┌─ DIAG: FİLTRELEME AŞAMASI ANALİZİ ──────────────────────`);

  const keywords = diagExtractKeywords(semanticQuery);
  console.log(`  │`);
  console.log(`  │  SSB'den çıkarılan anlamlı kelimeler:`);
  console.log(`  │    [${keywords.join(", ") || "(hiçbiri)"}]`);
  console.log(`  │`);

  let simResults = rawResponseMeta.results;
  const totalIn = simResults.length;

  // Stage A: type filter
  const afterType = simResults.filter((work) => {
    const t = work.type as string | undefined;
    return t === "article" || t === "book-chapter" || t === "book";
  });
  console.log(`  │  A) Tip filtresi (article/book-chapter/book)`);
  console.log(
    `  │     Öncesi: ${totalIn}  →  Sonrası: ${afterType.length}  (elenen: ${totalIn - afterType.length})`,
  );
  simResults = afterType;

  // Stage B: page-length filter
  const afterPage = simResults.filter((work) => {
    const biblio = work.biblio as Record<string, unknown> | undefined;
    if (!biblio) return true;
    const fp = parseInt(biblio.first_page as string, 10);
    const lp = parseInt(biblio.last_page as string, 10);
    if (isNaN(fp) || isNaN(lp)) return true;
    return lp - fp > 2;
  });
  console.log(`  │  B) Sayfa sayısı filtresi (last_page - first_page > 2)`);
  console.log(
    `  │     Öncesi: ${simResults.length}  →  Sonrası: ${afterPage.length}  (elenen: ${simResults.length - afterPage.length})`,
  );
  simResults = afterPage;

  // Stage C: abstract word count filter
  const afterAbstract = simResults.filter((work) => {
    const idx = work.abstract_inverted_index as
      | Record<string, unknown>
      | undefined;
    if (!idx) return true;
    return Object.keys(idx).length >= 40;
  });
  console.log(`  │  C) Abstract kelime sayısı (>= 40)`);
  console.log(
    `  │     Öncesi: ${simResults.length}  →  Sonrası: ${afterAbstract.length}  (elenen: ${simResults.length - afterAbstract.length})`,
  );
  simResults = afterAbstract;

  // Stage D: keyword matching filter
  if (keywords.length > 0) {
    const afterKeyword = simResults.filter((work) => {
      const title = ((work.title as string) ?? "").toLowerCase();
      const idx = work.abstract_inverted_index as
        | Record<string, unknown>
        | undefined;
      const abstractKeys = idx ? Object.keys(idx) : [];
      return keywords.some(
        (kw) =>
          title.includes(kw) ||
          abstractKeys.some((ak) => ak.includes(kw) || kw.includes(ak)),
      );
    });
    console.log(`  │  D) Anahtar kelime eşleştirmesi (başlık/abstract)`);
    console.log(
      `  │     Öncesi: ${simResults.length}  →  Sonrası: ${afterKeyword.length}  (elenen: ${simResults.length - afterKeyword.length})`,
    );
    simResults = afterKeyword;
  }

  const totalRemoved = totalIn - simResults.length;
  console.log(`  │`);
  console.log(`  │  ─── ÖZET ───`);
  console.log(`  │  Ham API dönüşü        : ${totalIn} nesne`);
  console.log(`  │  Tüm filtreler sonrası  : ${simResults.length} nesne`);
  console.log(
    `  │  Toplam elenen          : ${totalRemoved} (${totalIn > 0 ? ((totalRemoved / totalIn) * 100).toFixed(1) : "—"}%)`,
  );
  console.log(`  └${"─".repeat(57)}`);

  // ── 4) Call the real function and compare ────────────────────────────
  const realResult = await searchOpenAlex(semanticQuery);

  console.log(
    `\n  ┌─ DIAG: GERÇEK searchOpenAlex ÇIKTISI vs TAHMİN ───────────`,
  );
  console.log(`  │`);
  console.log(`  │  Gerçek dönen sayı    : ${realResult.length}`);
  console.log(`  │  Simüle edilen sayı    : ${simResults.length}`);
  if (realResult.length !== simResults.length) {
    console.log(`  │  ⚠️  FARK VAR! (olası neden: asenkron veri değişimi veya`);
    console.log(`  │     parseOpenAlexResults içindeki ek mantık)`);
  } else {
    console.log(`  │  ✅ Sayılar eşleşiyor`);
  }
  console.log(`  └${"─".repeat(57)}`);

  return realResult;
}

// ============================================================================
// YARDIMCI: enrichBatch
// ============================================================================
async function enrichBatch(
  articles: JuryArticle[],
  pool: ValidatedPaper[],
): Promise<JuryArticle[]> {
  const results: JuryArticle[] = [];
  for (let i = 0; i < articles.length; i += CROSSREF_CONCURRENCY) {
    const batch = articles.slice(i, i + CROSSREF_CONCURRENCY);
    const enriched = await Promise.all(
      batch.map((a) => enrichJuryArticleWithCrossRef(a, pool)),
    );
    results.push(...enriched);
  }
  return results;
}

// ============================================================================
// ANA TEST FONKSİYONU
// ============================================================================
async function main() {
  console.log(DIVIDER);
  console.log("  LİTERATÜR TARAMASI PIPELINE TESTI");
  console.log(`  Hedef Kutu: "${subBox.title}"`);
  console.log(DIVIDER);

  const flowId = createFlowId();
  const logger = new Logger(flowId);

  // ------------------------------------------------------------------
  // INPUT ÖZETİ
  // ------------------------------------------------------------------
  console.log(`\n  📋 KUTU BİLGİSİ\n`);
  console.log(`  Başlık: ${subBox.title}`);
  console.log(`  Açıklama: ${subBox.description}`);
  console.log(
    `  SSB (ilk 120): ${subBox.semanticSearchBlock.slice(0, 120)}...`,
  );
  console.log(`  Kurucu Eser Sayısı: ${subBox.foundationalQueries.length}`);
  subBox.foundationalQueries.forEach((fq, i) => {
    console.log(
      `    ${i + 1}. ${fq.author} (${fq.publicationYear}) — ${fq.title}`,
    );
  });

  // ==================================================================
  // PHASE 1: FOUNDATIONAL TRACK
  // ==================================================================
  console.log(DIVIDER);
  console.log("  🔰 AŞAMA 1: KURUCU ESER ÇÖZÜMLEME (OpenAlex)\n");

  const foundationalArticles: JuryArticle[] = [];

  const fStart = performance.now();
  logger.info("literature_foundational_start", {
    service: "literature",
    data: {
      queryCount: subBox.foundationalQueries.length,
      subBoxTitle: subBox.title,
    },
  });

  const resolved = await resolveFoundationalWorks(
    subBox.foundationalQueries,
    logger,
  );

  for (const fw of resolved) {
    foundationalArticles.push({
      type: "PRIMARY" as const,
      title: fw.title,
      abstract: "",
      url: fw.id,
      doi: "",
      publisher: fw.publisher ?? "",
      publicationYear: fw.publicationYear,
      authors: fw.authors,
      isFoundational: true,
    });
  }

  const fDuration = ((performance.now() - fStart) / 1000).toFixed(1);
  console.log(`  ✅ ${resolved.length} kurucu eser çözümlendi (${fDuration}s)`);
  resolved.forEach((fw) => {
    const atif =
      fw.citedByCount > 0 ? ` (atif: ${fw.citedByCount})` : " (fallback)";
    console.log(`    • ${fw.title} — ${fw.authors.join(", ")}${atif}`);
  });

  // ==================================================================
  // PHASE 2: OPENALEX SEMANTIC SEARCH
  // ==================================================================
  console.log(DIVIDER);
  console.log("  🔍 AŞAMA 2: OPENALEX SEMANTİK ARAMA\n");

  const searchStart = performance.now();
  logger.info("literature_search_start", {
    service: "literature",
    data: { subBoxTitle: subBox.title },
  });

  const semanticRaw = await diagnosticSearchOpenAlex(
    subBox.semanticSearchBlock,
  );
  const searchDuration = ((performance.now() - searchStart) / 1000).toFixed(1);

  console.log(
    `\n  ✅ ${semanticRaw.length} filtre sonrası sonuç (${searchDuration}s)`,
  );
  semanticRaw.slice(0, 5).forEach((p, i) => {
    console.log(
      `    ${i + 1}. [${p.relevanceScore.toFixed(2)}] ${p.title ?? "BAŞLIK YOK"}`,
    );
  });
  if (semanticRaw.length > 5) {
    console.log(`    ... ve ${semanticRaw.length - 5} daha`);
  }

  if (semanticRaw.length === 0 && foundationalArticles.length === 0) {
    console.log("\n  ⚠️  Hiç sonuç bulunamadı. Pipeline sonlandı.");
    process.exit(0);
  }

  if (semanticRaw.length === 0) {
    console.log(
      "\n  ⚠️  Semantic search boş, sadece kurucu eserlerle devam ediliyor.",
    );
    printFinalResult({ starterPack: foundationalArticles, reservedPool: [] });
    process.exit(0);
  }

  // ==================================================================
  // PHASE 3: MERGE / DEDUP
  // ==================================================================
  console.log(DIVIDER);
  console.log("  🔀 AŞAMA 3: BİRLEŞTİRME / DEDUPLİKASYON\n");

  const mergeStart = performance.now();
  const merged = mergePapers(semanticRaw);
  const mergeDuration = ((performance.now() - mergeStart) / 1000).toFixed(3);

  console.log(
    `  ✅ ${semanticRaw.length} ham → ${merged.length} benzersiz makale (${mergeDuration}s)`,
  );

  const rawApiPool = merged;

  // ==================================================================
  // PHASE 4: AI SIFTING
  // ==================================================================
  console.log(DIVIDER);
  console.log("  🧠 AŞAMA 4: AI ELEME (SIFTING) — Gemini LOW Thinking\n");

  const siftStart = performance.now();
  logger.info("literature_sifting_start", {
    service: "literature",
    data: { candidateCount: merged.length, subBoxTitle: subBox.title },
  });

  const sifted = await runSiftingStage(subBox, merged, logger, thesisCtx);
  const siftDuration = ((performance.now() - siftStart) / 1000).toFixed(1);

  console.log(
    `\n  ✅ ${merged.length} → ${sifted.length} makale elendi (${siftDuration}s)`,
  );
  console.log(
    `  📊 Kabul oranı: ${((sifted.length / merged.length) * 100).toFixed(1)}%`,
  );

  if (sifted.length === 0) {
    console.log(
      "\n  ⚠️  Hiç makale kalmadı. Sadece kurucu eserlerle devam ediliyor.",
    );
    printFinalResult({ starterPack: foundationalArticles, reservedPool: [] });
    process.exit(0);
  }

  sifted.slice(0, 5).forEach((p, i) => {
    const score = (p as unknown as Record<string, unknown>).siftingScore ?? "?";
    console.log(`    ${i + 1}. [Score: ${score}] ${p.title}`);
  });
  if (sifted.length > 5) {
    console.log(`    ... ve ${sifted.length - 5} daha`);
  }

  // ==================================================================
  // PHASE 5: ABSTRACT RECOVERY
  // ==================================================================
  console.log(DIVIDER);
  console.log("  📄 AŞAMA 5: ÖZET KURTARMA (ABSTRACT RECOVERY)\n");

  const abstractStart = performance.now();
  const siftedIds: string[] = [];
  for (const p of sifted) {
    if (p.openAlexId) siftedIds.push(p.openAlexId);
  }

  let abstractMap = new Map<string, string>();
  if (siftedIds.length > 0) {
    abstractMap = await fetchFullAbstracts(siftedIds);
  }

  for (const p of sifted) {
    if (p.openAlexId) {
      const resolved = abstractMap.get(p.openAlexId);
      if (resolved) p.abstract = resolved;
    }
    if (!p.abstract || !p.abstract.trim()) {
      p.abstract = "Özet verisi bulunamadı, başlık üzerinden değerlendirin";
    }
  }

  const abstractDuration = ((performance.now() - abstractStart) / 1000).toFixed(
    1,
  );
  const abstractRecoveryCount = Array.from(abstractMap.values()).filter(
    Boolean,
  ).length;
  console.log(
    `  ✅ ${siftedIds.length} ID üzerinden ${abstractRecoveryCount} özet kurtarıldı (${abstractDuration}s)`,
  );

  let shownAbstract = 0;
  for (const p of sifted) {
    if (p.abstract && p.abstract.length > 20 && shownAbstract < 2) {
      console.log(`\n  📝 ${p.title}:`);
      console.log(`     ${p.abstract.slice(0, 200)}...`);
      shownAbstract++;
    }
  }

  // ==================================================================
  // PHASE 6: AI JURY ANALYSIS
  // ==================================================================
  console.log(DIVIDER);
  console.log("  ⚖️  AŞAMA 6: AI JÜRİ ANALİZİ — Gemini HIGH Thinking\n");

  const juryStart = performance.now();
  const result = await runJuryStage(subBox, sifted, logger);
  const juryDuration = ((performance.now() - juryStart) / 1000).toFixed(1);

  console.log(`  ✅ Jüri analizi tamamlandı (${juryDuration}s)`);
  console.log(`  📊 Starter Pack: ${result.starterPack.length} makale`);
  console.log(`  📊 Reserved Pool: ${result.reservedPool.length} makale`);

  console.log("\n  ⭐ STARTER PACK:");
  result.starterPack.forEach((a, i) => {
    const year = a.publicationYear ? `(${a.publicationYear})` : "";
    const badge = a.type === "PRIMARY" ? "BİRİNCİL" : "İKİNCİL";
    const foundBadge = a.isFoundational ? " [KURUCU]" : "";
    console.log(`    ${i + 1}. [${badge}]${foundBadge} ${a.title} ${year}`);
    console.log(`       ${a.authors.slice(0, 3).join(", ")}`);
  });

  console.log(`\n  📋 RESERVED POOL (${result.reservedPool.length} makale):`);
  result.reservedPool.slice(0, 5).forEach((a, i) => {
    const year = a.publicationYear ? `(${a.publicationYear})` : "";
    console.log(`    ${i + 1}. ${a.title} ${year}`);
  });
  if (result.reservedPool.length > 5) {
    console.log(`    ... ve ${result.reservedPool.length - 5} daha`);
  }

  // ==================================================================
  // PHASE 7: CROSSREF VALIDATION
  // ==================================================================
  console.log(DIVIDER);
  console.log("  🔗 AŞAMA 7: CROSSREF DOĞRULAMA (Polite Pool)\n");

  const crossrefStart = performance.now();
  const [enrichedStarterPack, enrichedReservedPool] = await Promise.all([
    enrichBatch(result.starterPack, rawApiPool),
    enrichBatch(result.reservedPool, rawApiPool),
  ]);
  const crossrefDuration = ((performance.now() - crossrefStart) / 1000).toFixed(
    1,
  );

  console.log(
    `  ✅ ${enrichedStarterPack.length + enrichedReservedPool.length} makale CrossRef ile doğrulandı (${crossrefDuration}s)`,
  );

  let crossrefChanges = 0;
  for (let i = 0; i < enrichedStarterPack.length; i++) {
    const before = result.starterPack[i];
    const after = enrichedStarterPack[i];
    if (
      before?.publisher !== after.publisher ||
      before?.publicationYear !== after.publicationYear
    ) {
      crossrefChanges++;
      if (crossrefChanges <= 3) {
        console.log(`\n  🔄 ${after.title}`);
        if (before?.publisher !== after.publisher) {
          console.log(
            `     Yayınevi: ${before?.publisher ?? "?"} → ${after.publisher}`,
          );
        }
        if (before?.publicationYear !== after.publicationYear) {
          console.log(
            `     Yıl: ${before?.publicationYear ?? "?"} → ${after.publicationYear}`,
          );
        }
      }
    }
  }
  console.log(`  📊 CrossRef düzeltmesi yapılan: ${crossrefChanges} makale`);

  // ==================================================================
  // PHASE 8: FINAL ASSEMBLY
  // ==================================================================
  console.log(DIVIDER);
  console.log("  🏁 AŞAMA 8: SON MONTAJ (Foundational + Semantic)\n");

  let finalStarterPack = enrichedStarterPack;
  let finalReservedPool = enrichedReservedPool;

  if (foundationalArticles.length > 0) {
    const foundationalTitles = new Set(
      foundationalArticles
        .map((a) => a.title?.toLowerCase().trim())
        .filter(Boolean),
    );

    const dedupedStarterPack = enrichedStarterPack.filter(
      (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
    );
    const dedupedReservedPool = enrichedReservedPool.filter(
      (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
    );

    finalStarterPack = [...foundationalArticles, ...dedupedStarterPack];
    finalReservedPool = dedupedReservedPool;

    console.log(`  ✅ ${foundationalArticles.length} kurucu eser başa eklendi`);
    console.log(
      `  ✅ Semantic sonuçlardan ${enrichedStarterPack.length - dedupedStarterPack.length} tekrar kaldırıldı`,
    );
  }

  // ==================================================================
  // PHASE 9: SUMMARY
  // ==================================================================
  console.log(DIVIDER);
  console.log("  📊 ÖZET TABLOSU");
  console.log("  " + "─".repeat(60));
  console.log(`  Pipeline Adımı                       |    Süre     |  Sonuç`);
  console.log("  " + "─".repeat(60));
  console.log(
    `  1. Kurucu Eser Çözümleme             |   OpenAlex  |  ${foundationalArticles.length} eser`,
  );
  console.log(
    `  2. Semantik Arama                     |   OpenAlex  |  ${semanticRaw.length} sonuç`,
  );
  console.log(
    `  3. Deduplikasyon                      |   local     |  ${merged.length} benzersiz`,
  );
  console.log(
    `  4. AI Eleme (Sifting)                 |   Gemini L1 |  ${sifted.length}/${merged.length}`,
  );
  console.log(
    `  5. Özet Kurtarma                       |   OpenAlex  |  ${abstractRecoveryCount}/${siftedIds.length}`,
  );
  console.log(
    `  6. AI Jüri Analizi                     |   Gemini L2 |  ${result.starterPack.length}+${result.reservedPool.length}`,
  );
  console.log(
    `  7. CrossRef Doğrulama                  |   CrossRef  |  ${enrichedStarterPack.length + enrichedReservedPool.length}`,
  );
  console.log("  " + "─".repeat(60));
  console.log(
    `  Nihai Starter Pack                    |             |  ${finalStarterPack.length} makale`,
  );
  console.log(
    `  Nihai Reserved Pool                    |             |  ${finalReservedPool.length} makale`,
  );
  console.log("  " + "─".repeat(60));

  printFinalResult({
    starterPack: finalStarterPack,
    reservedPool: finalReservedPool,
  });
}

// ============================================================================
// SONUÇ YAZDIRMA
// ============================================================================
function printFinalResult(result: LiteratureReviewResult) {
  console.log(DIVIDER);
  console.log("  📦 NİHAİ LİTERATÜR HAVUZU (JSON)");
  console.log(DIVIDER);
  console.log(
    JSON.stringify(
      {
        starterPack: result.starterPack.map((a) => ({
          title: a.title,
          type: a.type,
          isFoundational: a.isFoundational,
          authors: a.authors,
          publicationYear: a.publicationYear,
          publisher: a.publisher,
          doi: a.doi || "—",
        })),
        reservedPool: result.reservedPool.map((a) => ({
          title: a.title,
          type: a.type,
          authors: a.authors,
          publicationYear: a.publicationYear,
          publisher: a.publisher,
          doi: a.doi || "—",
        })),
      },
      null,
      2,
    ),
  );

  console.log(DIVIDER);
  console.log("  ✅ PIPELINE TESTI BAŞARIYLA TAMAMLANDI");
  console.log(DIVIDER);
}

// ============================================================================
// EXEC
// ============================================================================
main().catch((err) => {
  console.error("\n  ❌ PIPELINE TESTI BAŞARISIZ!");
  console.error(`  Hata: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    console.error(`  Stack: ${err.stack.split("\n").slice(0, 4).join("\n")}`);
  }
  process.exit(1);
});
