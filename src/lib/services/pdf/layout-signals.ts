import { getResolvedPDFJS } from "unpdf";
import type { PageVisualSignals } from "./types";

/** Minimal structural type for a PDF.js operator list (the subset used here). */
export interface PdfOperatorListLike {
  fnArray: Array<number>;
  argsArray: Array<Array<unknown>>;
}

/**
 * Multiplies two 2D affine transformation matrices in PDF.js flat form.
 *
 * @param m1 - Current transformation matrix in flat form.
 * @param m2 - Operand transformation matrix in flat form.
 * @returns The resulting transformation matrix in flat form.
 */
function multiplyMatrix(m1: Array<number>, m2: Array<number>): Array<number> {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/**
 * Extracts visual signals from a page operator list to classify scanned, sidecar, and digital pages.
 *
 * @param operatorList - PDF.js operator list for the page.
 * @param pageWidth - Page width in points.
 * @param pageHeight - Page height in points.
 * @returns A promise resolving to the page visual signals.
 */
export async function analyzePageVisualSignals(
  operatorList: PdfOperatorListLike,
  pageWidth: number,
  pageHeight: number,
): Promise<PageVisualSignals> {
  const PDFJS = await getResolvedPDFJS();
  const OPS = PDFJS.OPS;

  let ctm: Array<number> = [1, 0, 0, 1, 0, 0];
  const stack: Array<Array<number>> = [];
  let imageArea = 0;
  let fontCount = 0;
  let hasInvisibleText = false;

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];

    if (fn === OPS.save) {
      stack.push(ctm.slice());
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      ctm = multiplyMatrix(ctm, args as Array<number>);
    } else if (fn === OPS.setFont) {
      fontCount++;
    } else if (fn === OPS.setTextRenderingMode) {
      if (args[0] === 3) hasInvisibleText = true;
    } else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageXObjectRepeat
    ) {
      const [a, b, c, d, e, f] = ctm;
      const xs = [e, e + a, e + c, e + a + c];
      const ys = [f, f + b, f + d, f + b + d];
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      if (w > 0 && h > 0) imageArea += w * h;
    }
  }

  const pageArea = pageWidth * pageHeight;
  return {
    imageAreaRatio: pageArea > 0 ? Math.min(1, imageArea / pageArea) : 0,
    fontCount,
    hasInvisibleText,
  };
}
