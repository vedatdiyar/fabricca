/**
 * Dosya tabanli log persistence katmani.
 * Sadece Node.js runtime'inda (sunucu ortami) çalisir;
 * tarayici veya Edge runtime'da sessizce no-op yapar.
 */

import fs from "fs";
import path from "path";

export interface PayloadData {
  flowId: string;
  timestamp: string;
  stage: string;
  module: string;
  prompt: string;
  response?: string;
}

/**
 * AI prompt/response çiftini .next/logs/ dizinine JSON dosyasi olarak yazar.
 * @returns Yazilan dosyanin tam yolu veya undefined (hata/çevre disi)
 */
export function writePayloadFile(
  flowId: string,
  stage: string,
  module: string,
  prompt: string,
  response?: string,
): string | undefined {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof window !== "undefined") return;

  try {
    const dir = path.resolve(process.cwd(), ".next/logs");
    fs.mkdirSync(dir, { recursive: true });
    const cleanId = flowId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(dir, `${cleanId}_${stage}_payload.json`);
    const payload: PayloadData = {
      flowId,
      timestamp: new Date().toISOString(),
      stage,
      module,
      prompt,
      response,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
    return filePath;
  } catch {
    return;
  }
}
