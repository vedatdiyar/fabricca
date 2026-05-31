import fs from "fs";
import path from "path";

/**
 * Service to interface with LlamaParse v2 API.
 * Uses agentic tier and latest version as requested.
 */

/**
 * Parses a PDF accessible via a presigned URL using LlamaParse v2.
 * Initiates the parse job and polls until completion.
 */
export async function parsePdfWithLlamaParse(
  presignedUrl: string,
): Promise<string> {
  const llamaKey =
    process.env.LLAMAPARSE_API_KEY || process.env.LLAMA_CLOUD_API_KEY;
  if (!llamaKey) {
    throw new Error(
      "LlamaParse API anahtarı bulunamadı (.env.local içindeki LLAMAPARSE_API_KEY).",
    );
  }

  // 0. Lokal önbellek bypass kontrolü (Geliştirme ortamı hızı için)
  const cacheDir = path.join(process.cwd(), ".cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const urlParts = presignedUrl.split("/");
  const fileName = urlParts[urlParts.length - 1].split("?")[0];
  const cacheFilePath = path.join(cacheDir, `${fileName}.md`);

  if (fs.existsSync(cacheFilePath)) {
    console.log(
      `♻️ [LOKAL CACHE HIT] LlamaParse pas geçildi! İçerik lokal diskteki cache dosyasından okundu: ${fileName}.md`,
    );
    return fs.readFileSync(cacheFilePath, "utf-8");
  }

  const startTime = Date.now();

  // 1. POST: Start LlamaParse v2 parse job
  console.log("Starting LlamaParse v2 parse job using secure URL...");
  const startRes = await fetch("https://api.cloud.llamaindex.ai/api/v2/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llamaKey}`,
    },
    body: JSON.stringify({
      source_url: presignedUrl,
      tier: "cost_effective",
      version: "latest",
      output_options: {
        images_to_save: [], // Görselleri atla
        markdown: {
          tables: {
            output_tables_as_markdown: true, // Tabloları koru
          },
        },
      },
      agentic_options: {
        custom_prompt:
          "Focus strictly on text and tables. Ignore all maps, charts, and embedded images to maximize speed. Always preserve the structure of all tables and output them as clean markdown tables.",
      },
    }),
  });

  if (!startRes.ok) {
    const errorText = await startRes.text();
    throw new Error(
      `LlamaParse v2 iş başlatma başarısız: ${startRes.statusText} - ${errorText}`,
    );
  }

  const startJson = (await startRes.json()) as Record<string, unknown>;
  const jobId =
    (startJson.id as string | undefined) ||
    ((startJson.job as Record<string, unknown> | undefined)?.id as
      | string
      | undefined);
  if (!jobId) {
    throw new Error("LlamaParse v2 iş ID'si alınamadı.");
  }
  console.log(`LlamaParse v2 job initialized with ID: ${jobId}`);

  // 2. GET & POLLING: Durum kontrolü ve markdown_full veri çekme
  let status = "PENDING";
  let resultJson: Record<string, unknown> | null = null;
  const maxAttempts = 60; // 15 minutes max with 15s delay

  for (let i = 0; i < maxAttempts; i++) {
    const pollRes = await fetch(
      `https://api.cloud.llamaindex.ai/api/v2/parse/${jobId}?expand=markdown_full`,
      {
        headers: {
          Authorization: `Bearer ${llamaKey}`,
        },
      },
    );

    if (pollRes.ok) {
      resultJson = (await pollRes.json()) as Record<string, unknown>;
      status =
        (resultJson.status as string | undefined) ||
        ((resultJson.job as Record<string, unknown> | undefined)?.status as
          | string
          | undefined) ||
        "PENDING";
      console.log(`LlamaParse v2 job status at attempt ${i + 1}: ${status}`);

      if (status === "COMPLETED") {
        break;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        const errorMsg =
          (resultJson.error_message as string | undefined) ||
          ((resultJson.job as Record<string, unknown> | undefined)
            ?.error_message as string | undefined) ||
          "Bilinmeyen hata";
        throw new Error(
          `LlamaParse döküman çözümleme işi başarısız/iptal oldu: ${errorMsg}`,
        );
      }
    } else {
      console.error(
        `LlamaParse v2 polling failed at attempt ${i + 1}: ${pollRes.statusText}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }

  if (status !== "COMPLETED" || !resultJson) {
    throw new Error(
      "LlamaParse döküman çözümleme zaman aşımına uğradı (15 dakika).",
    );
  }

  const fullMarkdown =
    (resultJson.markdown_full as string | undefined) ||
    ((resultJson.job as Record<string, unknown> | undefined)?.markdown_full as
      | string
      | undefined) ||
    "";
  if (!fullMarkdown || !fullMarkdown.trim()) {
    throw new Error("LlamaParse v2 tarafından çözümlenen Markdown metni boş.");
  }

  const durationMs = Date.now() - startTime;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  console.log(
    `🎉 [BAŞARILI] LlamaParse analizi toplam ${minutes} dakika ${seconds} saniye sürdü!`,
  );

  fs.writeFileSync(cacheFilePath, fullMarkdown, "utf-8");
  console.log(
    `💾 [LOKAL CACHE WRITE] LlamaParse çıktısı sonraki denemeler için diske başarıyla yedeklendi: ${fileName}.md`,
  );

  return fullMarkdown;
}
