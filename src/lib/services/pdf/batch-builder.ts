import type { PageBatch, PageClassification } from "./types";

/** Max pages sent to the LlamaParse API in a single job; larger B/C batches are split. */
const MAX_API_PAGES_PER_JOB = 100;

/** Smooth batching: only exactly one isolated B page flanked by A pages is absorbed into A. */
const ABSORB_B_THRESHOLD = 1;

/**
 * Groups consecutive same-label pages into raw blocks, each with its page range.
 *
 * @param classifications - Page classifications to group.
 * @returns Raw page blocks grouped by label with their page ranges.
 */
function buildRawBlocks(classifications: PageClassification[]): Array<{
  label: "A" | "B" | "C";
  startPage: number;
  endPage: number;
  pageCount: number;
}> {
  if (classifications.length === 0) return [];

  const sorted = [...classifications].sort((a, b) => a.pageIndex - b.pageIndex);
  const blocks: Array<{
    label: "A" | "B" | "C";
    startPage: number;
    endPage: number;
    pageCount: number;
  }> = [];

  let current = {
    label: sorted[0].label,
    startPage: sorted[0].pageIndex,
    endPage: sorted[0].pageIndex,
    pageCount: 1,
  };

  for (let i = 1; i < sorted.length; i++) {
    const page = sorted[i];
    if (page.label === current.label) {
      current.endPage = page.pageIndex;
      current.pageCount++;
    } else {
      blocks.push({ ...current });
      current = {
        label: page.label,
        startPage: page.pageIndex,
        endPage: page.pageIndex,
        pageCount: 1,
      };
    }
  }
  blocks.push({ ...current });

  return blocks;
}

/**
 * Absorbs isolated B blocks flanked by A blocks into A; C blocks are never absorbed.
 *
 * @param blocks - Raw page blocks after grouping.
 * @returns Page blocks with eligible B blocks converted to A.
 */
function applyAbsorption(
  blocks: ReturnType<typeof buildRawBlocks>,
): ReturnType<typeof buildRawBlocks> {
  if (blocks.length < 3) return blocks;

  const result = [...blocks];
  let changed = true;

  while (changed) {
    changed = false;
    for (let i = 1; i < result.length - 1; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      const next = result[i + 1];

      if (
        curr.label === "B" &&
        curr.pageCount <= ABSORB_B_THRESHOLD &&
        prev.label === "A" &&
        next.label === "A"
      ) {
        result[i] = { ...curr, label: "A" };
        changed = true;
        result[i - 1] = {
          ...prev,
          endPage: next.endPage,
          pageCount: prev.pageCount + curr.pageCount + next.pageCount,
        };
        result.splice(i, 2);
        break;
      }
    }
  }

  return result;
}

/**
 * Splits API batches exceeding MAX_API_PAGES_PER_JOB into sub-batches; A batches are exempt.
 *
 * @param blocks - Page blocks after absorption.
 * @returns Page blocks with oversized API batches split into smaller chunks.
 */
function splitOversizedApiBatches(
  blocks: ReturnType<typeof buildRawBlocks>,
): Array<{
  label: "A" | "B" | "C";
  startPage: number;
  endPage: number;
  pageCount: number;
}> {
  const result: typeof blocks = [];

  for (const block of blocks) {
    if (block.label === "A" || block.pageCount <= MAX_API_PAGES_PER_JOB) {
      result.push(block);
      continue;
    }

    let start = block.startPage;
    while (start <= block.endPage) {
      const end = Math.min(start + MAX_API_PAGES_PER_JOB - 1, block.endPage);
      result.push({
        label: block.label,
        startPage: start,
        endPage: end,
        pageCount: end - start + 1,
      });
      start = end + 1;
    }
  }

  return result;
}

/**
 * Determines the LlamaParse tier: agentic when any C page exists, otherwise cost effective.
 *
 * @param blocks - Page blocks used to detect C and B pages.
 * @returns LlamaParse tier for API batches.
 */
function resolveApiTier(
  blocks: ReturnType<typeof buildRawBlocks>,
): "cost_effective" | "agentic" {
  const hasB = blocks.some((b) => b.label === "B");
  const hasC = blocks.some((b) => b.label === "C");

  if (hasC) return "agentic";
  if (hasB) return "cost_effective";
  return "cost_effective";
}

/**
 * Converts page classifications into consecutive PageBatch groups with per-document LlamaParse tier resolution.
 *
 * @param classifications - Page classifications to group.
 * @returns Batches ready for the PDF extraction pipeline.
 */
export function buildBatches(
  classifications: PageClassification[],
): PageBatch[] {
  if (classifications.length === 0) return [];

  const rawBlocks = buildRawBlocks(classifications);
  const absorbedBlocks = applyAbsorption(rawBlocks);
  const splitBlocks = splitOversizedApiBatches(absorbedBlocks);
  const apiTier = resolveApiTier(splitBlocks);

  return splitBlocks.map((block) => ({
    label: block.label,
    startPage: block.startPage,
    endPage: block.endPage,
    pageCount: block.pageCount,
    llamaParseTier: block.label !== "A" ? apiTier : undefined,
  }));
}
