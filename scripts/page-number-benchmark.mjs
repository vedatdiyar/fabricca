/**
 * Page-Number Detection Benchmark (Proof-of-Concept)
 *
 * Validates printed-page-number detection before permanent parser integration.
 * Detects the "printed" page number (e.g. 119-151) printed in a running
 * header/footer, independent of the physical PDF page index.
 *
 * Pipeline per PDF:
 *   1. extractTextWithPositions -> positioned text items.
 *   2. Per page, gather items in the top band (y < TOP_FRACTION*H) and bottom
 *      band (y > (1-TOP_FRACTION)*H).
 *   3. Font-size filter: header/footer runs are typically smaller than the
 *      body median (literature: <0.78x body average). We use 0.85x to be safe.
 *   4. Digit masking (@): replace every digit run in band lines, so "121" and
 *      "122" collapse to "@" — matching the same running-head across pages.
 *   5. Page-association: only band lines whose masked form repeats on other
 *      pages are treated as header/footer; candidate number = digits in them.
 *   6. Anchor validation: a candidate page number is only accepted when it
 *      forms a +1 consecutive run over >= ANCHOR_LEN pages (kills years,
 *      TOC refs, and pp. citations).
 *   7. Output [Digital Page] -> [Calculated Printed Page] mapping.
 *
 * Usage: node scripts/page-number-benchmark.mjs [path-to-pdf-dir]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { extractTextWithPositions } from "@firecrawl/pdf-inspector";

const TOP_FRACTION = 0.15;
const MASK_CHAR = "@";
const ANCHOR_LEN = 3;
const MAX_GAP = 3;
const YEAR_RANGE = [1900, 2100];
const FONT_RATIO = 0.85;

function maskDigits(text) {
  return text.replace(/\d+/g, MASK_CHAR);
}

function extractDigitRuns(text) {
  return [...text.matchAll(/\d+/g)].map((m) => parseInt(m[0], 10));
}

/**
 * Collapses a per-page item list into ordered rows (x-sorted lines) sharing
 * the same vertical band so header/footer lines can be compared across pages.
 */
function groupRows(items, pageHeight) {
  const rows = [];
  const used = new Set();
  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const rowItems = [items[i]];
    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      const a = items[i];
      const b = items[j];
      const overlap =
        Math.min(a.y + a.height, b.y + b.height) -
          Math.max(a.y, b.y) >=
        Math.min(a.height, b.height) * 0.5;
      if (overlap) {
        used.add(j);
        rowItems.push(b);
      }
    }
    rowItems.sort((a, b) => a.x - b.x);
    const text = rowItems.map((it) => it.text.trim()).join(" ").replace(/\s+/g, " ");
    rows.push({
      text,
      x0: rowItems[0].x,
      fontSize: rowItems[0].fontSize,
    });
  }
  rows.sort((a, b) => a.x0 - b.x0);
  void pageHeight;
  return rows;
}

/**
 * Runs the full detection pipeline for one PDF buffer.
 */
function detectPrintedPages(buffer) {
  const items = extractTextWithPositions(buffer);
  if (items.length === 0) return { pages: [], diagnostics: { noItems: true } };

  const width = Math.max(...items.map((it) => it.x + it.width));
  const height = Math.max(...items.map((it) => it.y + it.height));

  // Body font median (middle 60% of page height) for font-size filtering.
  const midItems = items.filter(
    (it) => it.y > height * 0.2 && it.y + it.height < height * 0.8,
  );
  const bodySizes = midItems.map((it) => it.fontSize).filter((s) => s > 0);
  const bodyMedian = bodySizes.length
    ? bodySizes.sort((a, b) => a - b)[Math.floor(bodySizes.length / 2)]
    : null;

  const byPage = new Map();
  for (const it of items) {
    if (!byPage.has(it.page)) byPage.set(it.page, []);
    byPage.get(it.page).push(it);
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  const maxPage = pages[pages.length - 1];

  // Per-page band rows.
  const pageRows = new Map();
  for (const page of pages) {
    const bandItems = byPage.get(page).filter((it) => {
      const topBand = it.y < height * TOP_FRACTION;
      const bottomBand = it.y + it.height > height * (1 - TOP_FRACTION);
      return topBand || bottomBand;
    });
    pageRows.set(page, groupRows(bandItems, height));
  }

  // Page-association: masked line must appear on >= 2 distinct pages.
  const maskedCount = new Map();
  for (const page of pages) {
    for (const row of pageRows.get(page)) {
      const key = maskDigits(row.text);
      if (!key || key.length < 2) continue;
      maskedCount.set(key, (maskedCount.get(key) ?? 0) + 1);
    }
  }

  // Build per-page candidate printed numbers.
  const candidates = new Map();
  for (const page of pages) {
    const set = new Set();
    for (const row of pageRows.get(page)) {
      const masked = maskDigits(row.text);
      if ((maskedCount.get(masked) ?? 0) < 2) continue; // recurring header only
      const runs = extractDigitRuns(row.text);
      for (const num of runs) {
        if (num >= YEAR_RANGE[0] && num <= YEAR_RANGE[1]) continue; // kill years
        set.add(num);
      }
    }
    // Font-size filter on standalone numeric items in the bands.
    for (const it of byPage.get(page)) {
      const topBand = it.y < height * TOP_FRACTION;
      const bottomBand = it.y + it.height > height * (1 - TOP_FRACTION);
      if (!topBand && !bottomBand) continue;
      if (!/^\d{1,4}$/.test(it.text.trim())) continue;
      const num = parseInt(it.text.trim(), 10);
      if (num >= YEAR_RANGE[0] && num <= YEAR_RANGE[1]) continue;
      if (bodyMedian && it.fontSize > 0 && it.fontSize > bodyMedian * FONT_RATIO)
        continue;
      set.add(num);
    }
    candidates.set(page, set);
  }

  // Anchor resolution: +1 consecutive run over ANCHOR_LEN pages.
  const printed = new Map();
  const confirmed = new Set();

  const isMatch = (page, expect) => {
    if (!candidates.has(page)) return false;
    return candidates.get(page).has(expect);
  };

  // Find a start anchor.
  for (let start = 0; start <= maxPage - ANCHOR_LEN; start++) {
    for (const n of candidates.get(start) ?? []) {
      let ok = true;
      for (let k = 1; k < ANCHOR_LEN; k++) {
        if (!isMatch(start + k, n + k)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (let k = 0; k < ANCHOR_LEN; k++) {
          printed.set(start + k, n + k);
        }
        confirmed.add(n);
        break;
      }
    }
    if (confirmed.size > 0) break;
  }

  if (confirmed.size === 0) return { pages, printed, candidates };

  // Forward fill with gap tolerance; re-anchor if a new run is found.
  for (let page = 0; page <= maxPage; page++) {
    if (printed.has(page)) continue;
    const prev = [...printed.keys()].filter((p) => p < page).sort((a, b) => b - a)[0];
    if (prev === undefined) continue;
    const prevVal = printed.get(prev);
    const gap = page - prev;
    if (gap <= MAX_GAP) {
      printed.set(page, prevVal + gap);
      continue;
    }
    // Try re-anchor from this page.
    for (const n of candidates.get(page) ?? []) {
      let ok = true;
      for (let k = 1; k < ANCHOR_LEN; k++) {
        if (!isMatch(page + k, n + k)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (let k = 0; k < ANCHOR_LEN; k++) {
          printed.set(page + k, n + k);
        }
        confirmed.add(n);
        break;
      }
    }
  }

  return { pages, printed, candidates, bodyMedian };
}

function main() {
  const dir = process.argv[2] ?? join(process.cwd(), "Test PDF");
  const files = readdirSync(dir)
    .filter((f) => extname(f).toLowerCase() === ".pdf")
    .sort();

  for (const file of files) {
    const buffer = readFileSync(join(dir, file));
    const start = Date.now();
    const result = detectPrintedPages(buffer);
    const elapsed = Date.now() - start;

    console.log(`\n${"─".repeat(78)}`);
    console.log(`FILE: ${file}  (${result.pages.length} pages, ${elapsed} ms)`);

    if (result.diagnostics?.noItems) {
      console.log("  ⚠ no text items (likely scanned / OCR-needed)");
      continue;
    }

    const resolved = result.pages.filter((p) => result.printed.has(p));
    const contiguous = [];
    let runStart = -1;
    let runVal = -1;
    let runLast = -1;
    let runVal0 = -1;
    for (let i = 0; i <= result.pages[result.pages.length - 1]; i++) {
      if (result.printed.has(i)) {
        const v = result.printed.get(i);
        if (runStart !== -1 && v === runVal + (i - runLast)) {
          runLast = i;
          runVal = v;
        } else {
          if (runStart !== -1) contiguous.push([runStart, runLast, runVal0]);
          runStart = i;
          runLast = i;
          runVal = v;
          runVal0 = v;
        }
      } else {
        if (runStart !== -1) {
          contiguous.push([runStart, runLast, runVal0]);
          runStart = -1;
        }
      }
    }
    if (runStart !== -1) contiguous.push([runStart, runLast, runVal0]);

    console.log(
      `  coverage: ${resolved.length}/${result.pages.length} pages mapped`,
    );
    console.log(`  bodyMedian fs=${result.bodyMedian?.toFixed(1) ?? "?"}`);

    const longest = contiguous.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    if (longest) {
      console.log(
        `  longest contiguous run: d${longest[0]}..d${longest[1]} -> ${longest[2]}..${
          longest[2] + (longest[1] - longest[0])
        }`,
      );
    }

    // Sample output: first 14 resolved mappings.
    const sample = resolved.slice(0, 14);
    console.log("  [Digital Page] -> [Calculated Printed Page]");
    for (const p of sample) {
      console.log(`    d${String(p).padStart(3)}  ->  ${String(result.printed.get(p)).padStart(4)}`);
    }
    if (resolved.length > 14) {
      const tail = resolved.slice(-4);
      console.log("    ...");
      for (const p of tail) {
        console.log(`    d${String(p).padStart(3)}  ->  ${String(result.printed.get(p)).padStart(4)}`);
      }
    }
  }
}

main();
