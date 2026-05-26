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
      tier: "agentic",
      version: "latest",
    }),
  });

  if (!startRes.ok) {
    const errorText = await startRes.text();
    throw new Error(
      `LlamaParse v2 iş başlatma başarısız: ${startRes.statusText} - ${errorText}`,
    );
  }

  const startJson = await startRes.json();
  const jobId = startJson.id || startJson.job?.id;
  if (!jobId) {
    throw new Error("LlamaParse v2 iş ID'si alınamadı.");
  }
  console.log(`LlamaParse v2 job initialized with ID: ${jobId}`);

  // 2. GET & POLLING: Durum kontrolü ve markdown_full veri çekme
  let status = "PENDING";
  let resultJson: any = null;
  const maxAttempts = 60; // 5 minutes max with 5s delay

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
      resultJson = await pollRes.json();
      status = resultJson.status || resultJson.job?.status || "PENDING";
      console.log(`LlamaParse v2 job status at attempt ${i + 1}: ${status}`);

      if (status === "COMPLETED") {
        break;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        const errorMsg =
          resultJson.error_message ||
          resultJson.job?.error_message ||
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
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  if (status !== "COMPLETED") {
    throw new Error(
      "LlamaParse döküman çözümleme zaman aşımına uğradı (5 dakika).",
    );
  }

  const fullMarkdown =
    resultJson.markdown_full || resultJson.job?.markdown_full || "";
  if (!fullMarkdown || !fullMarkdown.trim()) {
    throw new Error("LlamaParse v2 tarafından çözümlenen Markdown metni boş.");
  }

  return fullMarkdown;
}
