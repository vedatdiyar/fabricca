export interface DiffLine {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface ValueDiff {
  path: string;
  val1: unknown;
  val2: unknown;
  type: "changed" | "added" | "removed" | "order_diff";
}

/**
 * Performs a greedy line-by-line diff with lookahead to find matching blocks.
 */
export function simpleLineDiff(str1: string, str2: string): DiffLine[] {
  const lines1 = (str1 || "").split("\n");
  const lines2 = (str2 || "").split("\n");
  const diff: DiffLine[] = [];

  let i = 0;
  let j = 0;

  while (i < lines1.length || j < lines2.length) {
    if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
      diff.push({ value: lines1[i] });
      i++;
      j++;
    } else {
      // Find if lines1[i] exists in lines2 further down
      let foundIn2 = -1;
      const lookahead = 20;
      for (let k = j; k < Math.min(lines2.length, j + lookahead); k++) {
        if (lines2[k] === lines1[i]) {
          foundIn2 = k;
          break;
        }
      }

      // Find if lines2[j] exists in lines1 further down
      let foundIn1 = -1;
      for (let k = i; k < Math.min(lines1.length, i + lookahead); k++) {
        if (lines1[k] === lines2[j]) {
          foundIn1 = k;
          break;
        }
      }

      if (
        foundIn2 !== -1 &&
        (foundIn1 === -1 || foundIn2 - j <= foundIn1 - i)
      ) {
        // lines2 has some insertions
        while (j < foundIn2) {
          diff.push({ value: lines2[j], added: true });
          j++;
        }
      } else if (foundIn1 !== -1) {
        // lines1 has some deletions
        while (i < foundIn1) {
          diff.push({ value: lines1[i], removed: true });
          i++;
        }
      } else {
        // Both lines are different
        if (i < lines1.length) {
          diff.push({ value: lines1[i], removed: true });
          i++;
        }
        if (j < lines2.length) {
          diff.push({ value: lines2[j], added: true });
          j++;
        }
      }
    }
  }
  return diff;
}

function getTypeOf(val: unknown): string {
  if (Array.isArray(val)) return "array";
  if (val === null) return "null";
  if (typeof val === "object") return "object";
  return typeof val;
}

/**
 * Deeply compares two objects/values and finds value edits and ordering differences.
 */
export function deepDiff(
  obj1: unknown,
  obj2: unknown,
  path: string = "",
): ValueDiff[] {
  const diffs: ValueDiff[] = [];

  const type1 = getTypeOf(obj1);
  const type2 = getTypeOf(obj2);

  if (type1 !== type2) {
    diffs.push({ path, val1: obj1, val2: obj2, type: "changed" });
    return diffs;
  }

  if (type1 === "array") {
    const arr1 = obj1 as unknown[];
    const arr2 = obj2 as unknown[];

    // Check if they have the same elements but different order
    if (arr1.length === arr2.length) {
      const sorted1 = [...arr1].sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
      );
      const sorted2 = [...arr2].sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
      );

      const isSameSet = JSON.stringify(sorted1) === JSON.stringify(sorted2);
      const isSameOrder = JSON.stringify(arr1) === JSON.stringify(arr2);

      if (isSameSet && !isSameOrder) {
        diffs.push({ path, val1: arr1, val2: arr2, type: "order_diff" });
        return diffs;
      }
    }

    // If not order-diff, compare item-by-item
    const maxLength = Math.max(arr1.length, arr2.length);
    for (let i = 0; i < maxLength; i++) {
      const itemPath = `${path}[${i}]`;
      if (i >= arr1.length) {
        diffs.push({
          path: itemPath,
          val1: undefined,
          val2: arr2[i],
          type: "added",
        });
      } else if (i >= arr2.length) {
        diffs.push({
          path: itemPath,
          val1: arr1[i],
          val2: undefined,
          type: "removed",
        });
      } else {
        diffs.push(...deepDiff(arr1[i], arr2[i], itemPath));
      }
    }
  } else if (type1 === "object" && obj1 !== null && obj2 !== null) {
    const o1 = obj1 as Record<string, unknown>;
    const o2 = obj2 as Record<string, unknown>;
    const keys1 = Object.keys(o1);
    const keys2 = Object.keys(o2);

    const allKeys = Array.from(new Set([...keys1, ...keys2]));

    // Check key order difference
    const commonKeys = keys1.filter((k) => keys2.includes(k));
    const order1 = commonKeys;
    const order2 = keys2.filter((k) => keys1.includes(k));
    const isOrderDifferent = JSON.stringify(order1) !== JSON.stringify(order2);

    if (isOrderDifferent) {
      diffs.push({
        path: path ? `${path} (keys order)` : "keys order",
        val1: keys1,
        val2: keys2,
        type: "order_diff",
      });
    }

    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      if (!(key in o1)) {
        diffs.push({
          path: keyPath,
          val1: undefined,
          val2: o2[key],
          type: "added",
        });
      } else if (!(key in o2)) {
        diffs.push({
          path: keyPath,
          val1: o1[key],
          val2: undefined,
          type: "removed",
        });
      } else {
        diffs.push(...deepDiff(o1[key], o2[key], keyPath));
      }
    }
  } else {
    if (obj1 !== obj2) {
      diffs.push({ path, val1: obj1, val2: obj2, type: "changed" });
    }
  }

  return diffs;
}

export interface ComparisonReport {
  isIdentical: boolean;
  varianceCategory: "A" | "B" | "C" | "D";
  categoryName: string;
  categoryExplanation: string;
  diffs: {
    promptDiffCount: number;
    payloadDiffs: ValueDiff[];
    thesisMatrixDiffs: ValueDiff[];
  };
}

/**
 * Analyzes differences and outputs the variance category and detailed report.
 */
export function compareLlmRequests(
  log1: {
    timestamp: string;
    systemInstruction: string;
    userPrompt: string;
    payload: unknown;
    thesisMatrix: unknown;
  },
  log2: {
    timestamp: string;
    systemInstruction: string;
    userPrompt: string;
    payload: unknown;
    thesisMatrix: unknown;
  },
): ComparisonReport {
  const promptDiffLines = simpleLineDiff(
    `System:\n${log1.systemInstruction}\n\nUser:\n${log1.userPrompt}`,
    `System:\n${log2.systemInstruction}\n\nUser:\n${log2.userPrompt}`,
  );
  const promptDiffCount = promptDiffLines.filter(
    (l) => l.added || l.removed,
  ).length;

  const payloadDiffs = deepDiff(log1.payload, log2.payload);
  const thesisMatrixDiffs = deepDiff(log1.thesisMatrix, log2.thesisMatrix);

  const hasPromptDiff = promptDiffCount > 0;
  const hasPayloadDiff = payloadDiffs.length > 0;
  const hasMatrixDiff = thesisMatrixDiffs.length > 0;

  const isIdentical = !hasPromptDiff && !hasPayloadDiff && !hasMatrixDiff;

  let varianceCategory: "A" | "B" | "C" | "D" = "D";
  let categoryName = "True Model Nondeterminism";
  let categoryExplanation =
    "Girdiler, parametreler ve tez matrisi tamamen aynıdır. Çıktı farkı modelin stokastik yapısından (sampling variance) kaynaklanmaktadır.";

  if (!isIdentical) {
    const t1 = new Date(log1.timestamp).getTime();
    const t2 = new Date(log2.timestamp).getTime();
    const timeDeltaSeconds = Math.abs(t1 - t2) / 1000;

    if (
      !hasMatrixDiff &&
      (hasPromptDiff || hasPayloadDiff) &&
      timeDeltaSeconds < 5
    ) {
      varianceCategory = "B";
      categoryName = "Async/Race Condition";
      categoryExplanation =
        "Aynı tez matrisi kullanılmasına rağmen, eşzamanlı/yakın zamanlı tetiklemeler sırasında prompt veya payload montajında çakışma (state drift/async race condition) tespit edilmiştir.";
    } else if (hasMatrixDiff && timeDeltaSeconds > 5) {
      varianceCategory = "C";
      categoryName = "Caching Issue";
      categoryExplanation =
        "Çalışmalar arasında tez matrisi verilerinde farklılıklar vardır. Kullanıcı aynı girdiyle çalıştığını düşünse de, tarayıcı veya sunucu tarafındaki cache mekanizmaları güncel olmayan verileri beslemiş olabilir.";
    } else {
      varianceCategory = "A";
      categoryName = "Input Mismatch (State/Assembly Bug)";
      categoryExplanation =
        "LLM'e giden nihai prompt, payload veya kaynak tez matrisi birebir aynı değildir. Kodun dinamik veri yerleştirme (assembly) mantığında girdi farkı oluşmuştur.";
    }
  }

  return {
    isIdentical,
    varianceCategory,
    categoryName,
    categoryExplanation,
    diffs: {
      promptDiffCount,
      payloadDiffs,
      thesisMatrixDiffs,
    },
  };
}

export interface ValueDiff3Way {
  path: string;
  val1: unknown;
  val2: unknown;
  val3: unknown;
  type: "changed" | "added" | "removed" | "order_diff";
}

export interface ThreeWayComparisonReport {
  isIdentical: boolean;
  varianceCategory: "A" | "B" | "C" | "D";
  categoryName: string;
  categoryExplanation: string;
  diffs: {
    promptDiffCount12: number;
    promptDiffCount23: number;
    promptDiffCount13: number;
    payloadDiffs: ValueDiff3Way[];
    thesisMatrixDiffs: ValueDiff3Way[];
  };
}

export function deepDiff3Way(
  obj1: unknown,
  obj2: unknown,
  obj3: unknown,
  path: string = "",
): ValueDiff3Way[] {
  const type1 = getTypeOf(obj1);
  const type2 = getTypeOf(obj2);
  const type3 = getTypeOf(obj3);

  if (type1 !== type2 || type2 !== type3) {
    if (
      JSON.stringify(obj1) !== JSON.stringify(obj2) ||
      JSON.stringify(obj2) !== JSON.stringify(obj3)
    ) {
      return [{ path, val1: obj1, val2: obj2, val3: obj3, type: "changed" }];
    }
    return [];
  }

  if (type1 === "array") {
    const arr1 = obj1 as unknown[];
    const arr2 = obj2 as unknown[];
    const arr3 = obj3 as unknown[];

    const maxLength = Math.max(arr1.length, arr2.length, arr3.length);
    const diffs: ValueDiff3Way[] = [];
    for (let i = 0; i < maxLength; i++) {
      const itemPath = `${path}[${i}]`;
      const val1 = i < arr1.length ? arr1[i] : undefined;
      const val2 = i < arr2.length ? arr2[i] : undefined;
      const val3 = i < arr3.length ? arr3[i] : undefined;

      if (
        JSON.stringify(val1) !== JSON.stringify(val2) ||
        JSON.stringify(val2) !== JSON.stringify(val3)
      ) {
        diffs.push(...deepDiff3Way(val1, val2, val3, itemPath));
      }
    }
    return diffs;
  } else if (
    type1 === "object" &&
    obj1 !== null &&
    obj2 !== null &&
    obj3 !== null
  ) {
    const o1 = obj1 as Record<string, unknown>;
    const o2 = obj2 as Record<string, unknown>;
    const o3 = obj3 as Record<string, unknown>;

    const keys1 = Object.keys(o1);
    const keys2 = Object.keys(o2);
    const keys3 = Object.keys(o3);

    const allKeys = Array.from(new Set([...keys1, ...keys2, ...keys3]));
    const diffs: ValueDiff3Way[] = [];
    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      const val1 = key in o1 ? o1[key] : undefined;
      const val2 = key in o2 ? o2[key] : undefined;
      const val3 = key in o3 ? o3[key] : undefined;

      if (
        JSON.stringify(val1) !== JSON.stringify(val2) ||
        JSON.stringify(val2) !== JSON.stringify(val3)
      ) {
        diffs.push(...deepDiff3Way(val1, val2, val3, keyPath));
      }
    }
    return diffs;
  } else {
    if (obj1 !== obj2 || obj2 !== obj3) {
      return [{ path, val1: obj1, val2: obj2, val3: obj3, type: "changed" }];
    }
  }

  return [];
}

export function compareThreeLlmRequests(
  log1: {
    timestamp: string;
    systemInstruction: string;
    userPrompt: string;
    payload: unknown;
    thesisMatrix: unknown;
  },
  log2: {
    timestamp: string;
    systemInstruction: string;
    userPrompt: string;
    payload: unknown;
    thesisMatrix: unknown;
  },
  log3?: {
    timestamp: string;
    systemInstruction: string;
    userPrompt: string;
    payload: unknown;
    thesisMatrix: unknown;
  } | null,
): ThreeWayComparisonReport {
  if (!log3) {
    const rep2 = compareLlmRequests(log1, log2);
    return {
      isIdentical: rep2.isIdentical,
      varianceCategory: rep2.varianceCategory,
      categoryName: rep2.categoryName,
      categoryExplanation: rep2.categoryExplanation,
      diffs: {
        promptDiffCount12: rep2.diffs.promptDiffCount,
        promptDiffCount23: 0,
        promptDiffCount13: 0,
        payloadDiffs: rep2.diffs.payloadDiffs.map((d) => ({
          path: d.path,
          val1: d.val1,
          val2: d.val2,
          val3: undefined,
          type: d.type,
        })),
        thesisMatrixDiffs: rep2.diffs.thesisMatrixDiffs.map((d) => ({
          path: d.path,
          val1: d.val1,
          val2: d.val2,
          val3: undefined,
          type: d.type,
        })),
      },
    };
  }

  const promptDiff12 = simpleLineDiff(
    `System:\n${log1.systemInstruction}\n\nUser:\n${log1.userPrompt}`,
    `System:\n${log2.systemInstruction}\n\nUser:\n${log2.userPrompt}`,
  ).filter((l) => l.added || l.removed).length;

  const promptDiff23 = simpleLineDiff(
    `System:\n${log2.systemInstruction}\n\nUser:\n${log2.userPrompt}`,
    `System:\n${log3.systemInstruction}\n\nUser:\n${log3.userPrompt}`,
  ).filter((l) => l.added || l.removed).length;

  const promptDiff13 = simpleLineDiff(
    `System:\n${log1.systemInstruction}\n\nUser:\n${log1.userPrompt}`,
    `System:\n${log3.systemInstruction}\n\nUser:\n${log3.userPrompt}`,
  ).filter((l) => l.added || l.removed).length;

  const payloadDiffs = deepDiff3Way(log1.payload, log2.payload, log3.payload);
  const thesisMatrixDiffs = deepDiff3Way(
    log1.thesisMatrix,
    log2.thesisMatrix,
    log3.thesisMatrix,
  );

  const hasPromptDiff =
    promptDiff12 > 0 || promptDiff23 > 0 || promptDiff13 > 0;
  const hasPayloadDiff = payloadDiffs.length > 0;
  const hasMatrixDiff = thesisMatrixDiffs.length > 0;

  const isIdentical = !hasPromptDiff && !hasPayloadDiff && !hasMatrixDiff;

  let varianceCategory: "A" | "B" | "C" | "D" = "D";
  let categoryName = "True Model Nondeterminism";
  let categoryExplanation =
    "Girdiler, parametreler ve tez matrisi tamamen aynıdır. Çıktı farkı modelin stokastik yapısından (sampling variance) kaynaklanmaktadır.";

  if (!isIdentical) {
    if (hasMatrixDiff) {
      varianceCategory = "C";
      categoryName = "Caching Issue";
      categoryExplanation =
        "Çalışmalar arasında tez matrisi verilerinde farklılıklar vardır. Kullanıcı aynı girdiyle çalıştığını düşünse de, tarayıcı veya sunucu tarafındaki cache mekanizmaları güncel olmayan verileri beslemiş olabilir.";
    } else if (hasPromptDiff || hasPayloadDiff) {
      const t1 = new Date(log1.timestamp).getTime();
      const t2 = new Date(log2.timestamp).getTime();
      const t3 = new Date(log3.timestamp).getTime();
      const maxDelta =
        Math.max(Math.abs(t1 - t2), Math.abs(t2 - t3), Math.abs(t1 - t3)) /
        1000;

      if (maxDelta < 10) {
        varianceCategory = "B";
        categoryName = "Async/Race Condition";
        categoryExplanation =
          "Aynı tez matrisi kullanılmasına rağmen, eşzamanlı/yakın zamanlı tetiklemeler sırasında prompt veya payload montajında çakışma (state drift/async race condition) tespit edilmiştir.";
      } else {
        varianceCategory = "A";
        categoryName = "Input Mismatch (State/Assembly Bug)";
        categoryExplanation =
          "LLM'e giden nihai prompt, payload veya kaynak tez matrisi birebir aynı değildir. Kodun dinamik veri yerleştirme (assembly) mantığında girdi farkı oluşmuştur.";
      }
    }
  }

  return {
    isIdentical,
    varianceCategory,
    categoryName,
    categoryExplanation,
    diffs: {
      promptDiffCount12: promptDiff12,
      promptDiffCount23: promptDiff23,
      promptDiffCount13: promptDiff13,
      payloadDiffs,
      thesisMatrixDiffs,
    },
  };
}
