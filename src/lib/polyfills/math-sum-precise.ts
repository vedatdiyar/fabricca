/**
 * Polyfills `Math.sumPrecise` (ES2026) for Node.js runtimes that do not implement it
 * yet (e.g. Node v26.5.0 / V8 14.6.x), since the bundled PDF.js inside `pdf2md` calls
 * this method while converting embedded fonts during text extraction and throws
 * `TypeError: Math.sumPrecise is not a function` (degraded to a warning by PDF.js
 * internals) without it.
 *
 * Uses Neumaier compensated summation, which produces identical results to the
 * spec's xsum algorithm for the small-integer sums PDF.js performs.
 *
 * Must be imported before any module that calls `pdf2md`.
 */

declare global {
  interface Math {
    sumPrecise(numbers: Iterable<number>): number;
  }
}

if (typeof Math.sumPrecise !== "function") {
  Math.sumPrecise = function sumPrecise(numbers: Iterable<number>): number {
    let sum = 0;
    let compensation = 0;
    for (const number of numbers) {
      const y = number - compensation;
      const t = sum + y;
      compensation = t - sum - y;
      sum = t;
    }
    return sum;
  } as typeof Math.sumPrecise;
}

export {};
