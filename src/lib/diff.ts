/** A word-level diff segment for side-by-side rendering. */
export interface DiffSegment {
  type: "same" | "insert" | "delete";
  value: string;
}

/**
 * Splits text into word tokens while preserving the whitespace that separates them.
 *
 * @param text - The raw text to tokenize.
 * @returns The list of tokens including whitespace separators.
 */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}

/**
 * Computes a word-level LCS diff between two texts.
 *
 * @param original - The original (pre-edit) text.
 * @param polished - The edited text.
 * @returns An ordered list of segments tagging each token as unchanged, inserted, or deleted.
 */
export function computeDiff(original: string, polished: string): DiffSegment[] {
  const a = tokenize(original);
  const b = tokenize(polished);

  const lcs = (() => {
    const n = a.length;
    const m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
      new Array<number>(m + 1).fill(0),
    );
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }
    return dp;
  })();

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  const append = (type: DiffSegment["type"], value: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) {
      last.value += value;
    } else {
      segments.push({ type, value });
    }
  };

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      append("same", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      append("delete", a[i]);
      i++;
    } else {
      append("insert", b[j]);
      j++;
    }
  }

  while (i < a.length) {
    append("delete", a[i]);
    i++;
  }
  while (j < b.length) {
    append("insert", b[j]);
    j++;
  }

  return segments;
}
