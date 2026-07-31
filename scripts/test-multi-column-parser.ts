import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getDocumentProxy } from "unpdf";

interface TextItem {
  str: string;
  x: number;
  y: number;
}

function isNoiseItem(str: string): boolean {
  const s = str.trim();
  if (s.length <= 1) return true;
  if (s.length <= 2 && /^[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]+$/.test(s)) return true;
  return false;
}

/**
 * Smart Local Multi-Column Text Extractor.
 * Correctly orders full-width titles/headers, left-column, right-column, and footers.
 */
function extractColumnAwareText(
  items: TextItem[],
  pageWidth: number,
  pageHeight: number,
): string {
  const clean = items.filter(
    (it) => !isNoiseItem(it.str) && it.str.trim().length > 0,
  );
  if (clean.length === 0) return "";

  // Group text items by Y-coordinate (tolerance 6pt)
  const lineMap = new Map<number, TextItem[]>();
  for (const item of clean) {
    const yKey = Math.round(item.y / 6) * 6;
    if (!lineMap.has(yKey)) {
      lineMap.set(yKey, []);
    }
    lineMap.get(yKey)!.push(item);
  }

  // Determine line starts
  let leftStarts = 0;
  let rightStarts = 0;
  const midX = pageWidth * 0.48;

  for (const [, lineItems] of lineMap) {
    const minX = Math.min(...lineItems.map((i) => i.x));
    if (minX < midX) leftStarts++;
    else if (minX > pageWidth * 0.52) rightStarts++;
  }

  const isMultiCol = leftStarts >= 4 && rightStarts >= 3;

  if (!isMultiCol) {
    // Single column: Sort lines top-to-bottom (Y descending), then left-to-right (X ascending)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const lines: string[] = [];
    for (const y of sortedY) {
      const lineItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      lines.push(lineItems.map((it) => it.str.trim()).join(" "));
    }
    return lines.join("\n");
  }

  // Multi-column layout:
  // Identify header region (top 15% of page or items spanning across midX)
  const headerItems: TextItem[] = [];
  const col1Items: TextItem[] = [];
  const col2Items: TextItem[] = [];
  const footerItems: TextItem[] = [];

  const topHeaderThreshold = pageHeight * 0.85; // PDF Y 0 is bottom, Y max is top
  const bottomFooterThreshold = pageHeight * 0.1;

  for (const item of clean) {
    if (item.y > topHeaderThreshold) {
      headerItems.push(item);
    } else if (item.y < bottomFooterThreshold) {
      footerItems.push(item);
    } else if (item.x < midX) {
      col1Items.push(item);
    } else {
      col2Items.push(item);
    }
  }

  const formatRegion = (regItems: TextItem[]): string => {
    if (regItems.length === 0) return "";
    const regLines = new Map<number, TextItem[]>();
    for (const item of regItems) {
      const yKey = Math.round(item.y / 6) * 6;
      if (!regLines.has(yKey)) regLines.set(yKey, []);
      regLines.get(yKey)!.push(item);
    }
    const sortedY = Array.from(regLines.keys()).sort((a, b) => b - a);
    return sortedY
      .map((y) =>
        regLines
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map((it) => it.str.trim())
          .join(" "),
      )
      .join("\n");
  };

  const headerText = formatRegion(headerItems);
  const col1Text = formatRegion(col1Items);
  const col2Text = formatRegion(col2Items);
  const footerText = formatRegion(footerItems);

  return [headerText, col1Text, col2Text, footerText]
    .filter(Boolean)
    .join("\n\n");
}

async function testFiles() {
  const files = ["Double1.pdf", "Double2.pdf", "Cift Sütun Kısa.pdf"];

  console.log(
    "==================================================================",
  );
  console.log(" DİNAMİK YEREL ÇOKLU SÜTUN PARSER TESTİ");
  console.log(
    "==================================================================\n",
  );

  for (const fileName of files) {
    const filePath = resolve("TestPDF", fileName);
    const buffer = await readFile(filePath);
    const data = new Uint8Array(buffer);

    const start = performance.now();
    const doc = await getDocumentProxy(data);
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const items: TextItem[] = textContent.items
      .filter((it: Record<string, unknown>) => typeof it.str === "string")
      .map((it: Record<string, unknown>) => ({
        str: (it.str as string) || "",
        x: (it.transform as number[])[4] || 0,
        y: (it.transform as number[])[5] || 0,
      }));

    const extractedText = extractColumnAwareText(
      items,
      viewport.width,
      viewport.height,
    );
    const elapsed = (performance.now() - start).toFixed(1);

    console.log(`📄 DOSYA: ${fileName} (${elapsed} ms)`);
    console.log(
      `📝 ÇIKARILAN METİN İLK 400 KARAKTER:\n--------------------------------------------------`,
    );
    console.log(extractedText.slice(0, 450));
    console.log("--------------------------------------------------\n");
  }
}

testFiles().catch(console.error);
