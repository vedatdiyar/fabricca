"use server";

import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { db } from "@/db";
import { references, notes, pdfChunks, thesisCore } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * Custom Markdown Header Splitter to group document content hierarchically
 * based on headers (#, ##, ###) and preserve metadata context,
 * replicating LangChain's MarkdownHeaderTextSplitter behavior in JS/TS.
 */
function splitMarkdownByHeaders(
  markdown: string,
): Array<{ pageContent: string; metadata: any }> {
  const lines = markdown.split("\n");
  const sections: Array<{ pageContent: string; metadata: any }> = [];

  let currentHeader1 = "";
  let currentHeader2 = "";
  let currentHeader3 = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h1Match || h2Match || h3Match) {
      if (currentContent.length > 0) {
        sections.push({
          pageContent: currentContent.join("\n").trim(),
          metadata: {
            header_1: currentHeader1,
            header_2: currentHeader2,
            header_3: currentHeader3,
          },
        });
        currentContent = [];
      }

      if (h1Match) {
        currentHeader1 = h1Match[1].trim();
        currentHeader2 = "";
        currentHeader3 = "";
      } else if (h2Match) {
        currentHeader2 = h2Match[1].trim();
        currentHeader3 = "";
      } else if (h3Match) {
        currentHeader3 = h3Match[1].trim();
      }
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      pageContent: currentContent.join("\n").trim(),
      metadata: {
        header_1: currentHeader1,
        header_2: currentHeader2,
        header_3: currentHeader3,
      },
    });
  }

  if (sections.length === 0) {
    sections.push({
      pageContent: markdown.trim(),
      metadata: { header_1: "", header_2: "", header_3: "" },
    });
  }

  return sections;
}

/**
 * Sanitizes a filename by replacing Turkish characters and non-alphanumeric chars
 * to prevent encoding and URL issues.
 */
function sanitizeFileName(fileName: string): string {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "C",
    ğ: "g",
    Ğ: "G",
    ı: "i",
    İ: "I",
    ö: "o",
    Ö: "O",
    ş: "s",
    Ş: "S",
    ü: "u",
    Ü: "U",
  };

  let sanitized = fileName.replace(
    /[çÇğĞıİöÖşŞüÜ]/g,
    (match) => map[match] || match,
  );
  // Replace spaces and special characters with underscores, keeping dots, dashes and underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Replace multiple consecutive underscores with a single one
  sanitized = sanitized.replace(/_+/g, "_");
  return sanitized;
}

export interface AcademicMetadata {
  title: string;
  authors: string | null;
  year: number | null;
  doi: string | null;
  abstract: string | null;
}

/**
 * Extracts academic metadata (title, authors, year, doi, abstract) from the first 4000 characters
 * of a PDF's parsed markdown text using Google Gemini 3.1 Flash Lite.
 */
export async function extractAcademicMetadata(
  markdownFull: string,
  fallbackTitle: string,
): Promise<AcademicMetadata> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.warn(
      "Gemini API key not found. Using fallbacks for academic metadata.",
    );
    return {
      title: fallbackTitle,
      authors: "Bilinmeyen Yazar",
      year: null,
      doi: null,
      abstract: null,
    };
  }

  try {
    // Extract first 4000 characters
    const startText = markdownFull.substring(0, 4000);
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const systemPrompt =
      "Sen kıdemli bir akademik dökümantasyon ve kütüphanecilik uzmanısın. Sana verilen makale başlangıç metnini dikkatle incele. Makalenin resmi tam başlığını (title), yazarlarını (authors), yayınlandığı yılı (year), varsa resmi DOI numarasını (doi) ve makalenin kısa özeti/abstract alanını (abstract) ayıkla. Yanıtı KESİNLİKLE başka hiçbir açıklama, markdown işareti veya kod bloğu enjekte etmeden, sadece ve sadece şu JSON şemasında döndür: { title: string, authors: string, year: number, doi: string, abstract: string }";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: startText,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            authors: { type: "STRING" },
            year: { type: "INTEGER" },
            doi: { type: "STRING" },
            abstract: { type: "STRING" },
          },
          required: ["title", "authors", "year", "doi", "abstract"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Gemini returned an empty response.");
    }

    const data = JSON.parse(responseText.trim());

    // Validate and fallback
    return {
      title:
        data.title && typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : fallbackTitle,
      authors:
        data.authors && typeof data.authors === "string" && data.authors.trim()
          ? data.authors.trim()
          : "Bilinmeyen Yazar",
      year: data.year && typeof data.year === "number" ? data.year : null,
      doi:
        data.doi && typeof data.doi === "string" && data.doi.trim()
          ? data.doi.trim()
          : null,
      abstract:
        data.abstract &&
        typeof data.abstract === "string" &&
        data.abstract.trim()
          ? data.abstract.trim()
          : null,
    };
  } catch (error) {
    console.error("Error in extractAcademicMetadata:", error);
    return {
      title: fallbackTitle,
      authors: "Bilinmeyen Yazar",
      year: null,
      doi: null,
      abstract: null,
    };
  }
}

export interface UploadResult {
  success: boolean;
  error?: string;
  key?: string;
  pdfUrl?: string;
  fileName?: string;
  fileSize?: number;
  referenceId?: number;
}

/**
 * Server Action to upload a PDF file securely to Cloudflare R2 and save its meta to the Neon Database.
 * Returns unique persistent key and a secure presigned URL valid for 24 hours.
 */
export async function uploadPdfAction(
  formData: FormData,
): Promise<UploadResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "Dosya bulunamadı." };
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return { success: false, error: "Yalnızca PDF dosyaları yüklenebilir." };
    }

    // 1. Sanitize filename and create unique R2 key
    const sanitizedName = sanitizeFileName(file.name);
    const key = `${Date.now()}-${sanitizedName}`;

    // 2. Read file as ArrayBuffer and convert to Buffer for S3 upload compatibility
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload file to Cloudflare R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    });

    await r2Client.send(uploadCommand);

    // 4. Save metadata in the database references table
    const [newRef] = await db
      .insert(references)
      .values({
        title: file.name.replace(".pdf", ""),
        pdfUrl: key, // Storing R2 unique key as pdfUrl reference pointer
      })
      .returning();

    // 5. Generate a secure presigned GET URL for LlamaParse ingestion (valid for 24 hours)
    const downloadCommand = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(r2Client, downloadCommand, {
      expiresIn: 86400,
    });

    // 6. Run LlamaParse v2 + LangChain splitters + Gemini embeddings sequentially
    try {
      console.log(`Starting parsing pipeline for referenceId: ${newRef.id}...`);
      const llamaKey =
        process.env.LLAMAPARSE_API_KEY || process.env.LLAMA_CLOUD_API_KEY;
      if (!llamaKey) {
        throw new Error(
          "LlamaParse API anahtarı bulunamadı (.env.local içindeki LLAMAPARSE_API_KEY).",
        );
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error(
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
        );
      }

      // 1. POST: Start LlamaParse v2 parse job
      console.log("Starting LlamaParse v2 parse job using R2 secure URL...");
      const startRes = await fetch(
        "https://api.cloud.llamaindex.ai/api/v2/parse",
        {
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
        },
      );

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
          console.log(
            `LlamaParse v2 job status at attempt ${i + 1}: ${status}`,
          );

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
        throw new Error(
          "LlamaParse v2 tarafından çözümlenen Markdown metni boş.",
        );
      }

      // LangChain splitting
      const headerDividedDocs = splitMarkdownByHeaders(fullMarkdown);

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const finalChunks = await textSplitter.splitDocuments(headerDividedDocs);

      // Generate embeddings and store them
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const insertValues = [];

      for (let i = 0; i < finalChunks.length; i++) {
        const chunkText = finalChunks[i].pageContent;
        if (!chunkText || !chunkText.trim()) continue;

        const formattedText = `title: none | text: ${chunkText}`;
        const response = await ai.models.embedContent({
          model: "gemini-embedding-2",
          contents: formattedText,
          config: {
            outputDimensionality: 1536,
          },
        });

        const embeddingVector = response.embeddings?.[0]?.values;
        if (!embeddingVector || embeddingVector.length !== 1536) {
          throw new Error(
            `Embedding chunk ${i + 1} için geçerli 1536 boyutlu vektör alınamadı.`,
          );
        }

        insertValues.push({
          referenceId: newRef.id,
          content: chunkText,
          embedding: embeddingVector,
        });
      }

      if (insertValues.length > 0) {
        await db.insert(pdfChunks).values(insertValues);
        console.log(
          `Successfully split and stored ${insertValues.length} pdf_chunks for referenceId: ${newRef.id}`,
        );
      }

      // 7. Academic Metadata Extraction via Gemini 3.1 Flash Lite
      try {
        console.log(
          `Extracting academic metadata for referenceId: ${newRef.id}...`,
        );
        const metadata = await extractAcademicMetadata(
          fullMarkdown,
          file.name.replace(".pdf", ""),
        );

        await db
          .update(references)
          .set({
            title: metadata.title,
            authors: metadata.authors,
            year: metadata.year,
            doi: metadata.doi,
            abstract: metadata.abstract,
          })
          .where(eq(references.id, newRef.id));
        console.log(
          `Successfully extracted and updated academic metadata for referenceId: ${newRef.id}`,
        );
      } catch (metadataError) {
        console.error(
          "Failed to extract or update academic metadata, using fallbacks:",
          metadataError,
        );
        // Fallback update in case of failure to guarantee consistent defaults
        await db
          .update(references)
          .set({
            authors: "Bilinmeyen Yazar",
          })
          .where(eq(references.id, newRef.id));
      }
    } catch (pipelineError: any) {
      console.error("LlamaParse/LangChain RAG Pipeline Error: ", pipelineError);
      throw new Error(
        `Dosya yüklendi fakat RAG analizi başarısız oldu: ${pipelineError.message}`,
      );
    }

    return {
      success: true,
      key,
      pdfUrl: presignedUrl,
      fileName: sanitizedName,
      fileSize: file.size,
      referenceId: newRef.id,
    };
  } catch (error: any) {
    console.error("R2 Upload Error: ", error);
    return {
      success: false,
      error: error.message || "Dosya yüklenirken bilinmeyen bir hata oluştu.",
    };
  }
}

export interface GetReferencesResult {
  success: boolean;
  error?: string;
  references?: Array<{
    id: number;
    title: string;
    authors: string | null;
    year: number | null;
    doi: string | null;
    pdfUrl: string;
    abstract: string | null;
    createdAt: Date | null;
    downloadUrl: string;
  }>;
}

/**
 * Server Action to fetch all uploaded references from the database with dynamically generated presigned URLs.
 */
export async function getReferencesAction(): Promise<GetReferencesResult> {
  try {
    const allRefs = await db
      .select()
      .from(references)
      .orderBy(references.createdAt);

    // Map through references and generate temporary 24h presigned GET URLs
    const refsWithUrls = await Promise.all(
      allRefs.map(async (ref) => {
        const downloadCommand = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: ref.pdfUrl,
        });

        let url = "";
        try {
          url = await getSignedUrl(r2Client, downloadCommand, {
            expiresIn: 86400,
          });
        } catch (err) {
          console.error(`Failed to generate URL for key: ${ref.pdfUrl}`, err);
        }

        return {
          id: ref.id,
          title: ref.title,
          authors: ref.authors,
          year: ref.year,
          doi: ref.doi,
          pdfUrl: ref.pdfUrl,
          abstract: ref.abstract,
          createdAt: ref.createdAt,
          downloadUrl: url,
        };
      }),
    );

    return {
      success: true,
      references: refsWithUrls,
    };
  } catch (error: any) {
    console.error("Failed to get references: ", error);
    return {
      success: false,
      error: error.message || "Kaynaklar listelenirken bir hata oluştu.",
    };
  }
}

export interface SaveNoteResult {
  success: boolean;
  error?: string;
  noteId?: number;
}

/**
 * Server Action to save a reading note linked to a specific reference.
 * Generates a mock 1536-dimensional embedding with zeros for Phase 2.
 */
export async function saveNoteAction(
  referenceId: number,
  content: string,
): Promise<SaveNoteResult> {
  try {
    if (!content || !content.trim()) {
      return { success: false, error: "Not içeriği boş olamaz." };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Generate actual 1536-dimensional embedding using gemini-embedding-2
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: content.trim(),
      config: {
        outputDimensionality: 1536,
      },
    });

    const embeddingVector = response.embeddings?.[0]?.values;
    if (!embeddingVector || embeddingVector.length !== 1536) {
      return {
        success: false,
        error: "Not için 1536 boyutlu embedding vektörü üretilemedi.",
      };
    }

    // Load active thesis constitution and reference document metadata for context
    const [core] = await db.select().from(thesisCore).limit(1);
    const [ref] = await db
      .select()
      .from(references)
      .where(eq(references.id, referenceId))
      .limit(1);

    let aiContextSuggestions: string | null = null;

    try {
      let thesisContext = "";
      if (core) {
        thesisContext =
          `FİKRİ KESKİNLEŞTİRİLECEK ETKİN TEZ ANAYASASI:\n` +
          `- Başlık: ${core.title}\n` +
          `- Araştırma Sorusu: ${core.researchQuestion}\n` +
          `- Ana Argüman/Hipotez: ${core.argument}\n` +
          `- Yöntem/Teorik Çatı: ${core.methodology}\n\n`;
      } else {
        thesisContext = `TEZ ANAYASASI: Henüz tanımlanmadı. Genel akademik standartlar ve kuramsal entegrasyon kuralları çerçevesinde analiz yapın.\n\n`;
      }

      let sourceMetadata = "";
      if (ref) {
        sourceMetadata =
          `KAYNAK DÖKÜMAN BİLGİLERİ (KÜNYE):\n` +
          `- Başlık (Title): ${ref.title}\n` +
          `- Yazarlar (Authors): ${ref.authors || "Bilinmiyor"}\n` +
          `- Yıl (Year): ${ref.year || "Belirtilmemiş"}\n` +
          `- DOI: ${ref.doi || "Mevcut Değil"}\n` +
          `- Özet (Abstract): ${ref.abstract || "Mevcut Değil"}\n\n`;
      } else {
        sourceMetadata = "KAYNAK DÖKÜMAN BİLGİLERİ: Mevcut Değil.\n\n";
      }

      const systemPrompt =
        "Sen Siyaset Bilimi, Politik Sosyoloji ve Uluslararası İlişkiler alanlarında uzman, son derece seçkin, eleştirel ve yöntemsel hassasiyete sahip bir Akademik Tez Danışmanısın (Profesör).\n" +
        "Görevin, kullanıcının kütüphanesindeki bir makaleden aldığı ham okuma notunu, onun aktif tez anayasasıyla (başlık, araştırma sorusu, ana argüman, teorik çatı) ilişkilendirmek ve yapılandırılmış bir entegrasyon önerisi ile akademik atıf künyesi üretmektir.\n\n" +
        "Lütfen yanıtını KESİNLİKLE şu iki bölümü içerecek şekilde Markdown formatında döndür. Giriş, selamlama veya sonuç cümleleri yazma, doğrudan konuya gir:\n\n" +
        "### Entegrasyon Önerisi\n" +
        "[Bu notun, aktif tezin hangi kavramsal katmanına (Örn: Marx'ın yabancılaşma teorisi, biyo-politik dışlama vb.) veya hangi bölümüne nasıl entegre edilebileceğine dair pratik, keskin ve 2-3 cümlelik somut bir taktiksel akademik öneri yazın.]\n\n" +
        "### Akademik Atıf\n" +
        "[Döküman verilerine dayanarak temiz bir APA formatında akademik atıf künyesi oluşturun.]\n\n" +
        "KURALLAR:\n" +
        "1. Türkçe dilinde, son derece profesyonel, yapıcı ve doğrudan bir akademik üslup kullan.\n" +
        "2. Entegrasyon önerisini 2-3 cümle ile sınırla, lafı uzatma, doğrudan stratejik katma değere odaklan.\n" +
        "3. Çıktıda başka hiçbir ek metin, giriş veya kapanış ifadesi barındırma.";

      const userPrompt =
        `${thesisContext}` +
        `${sourceMetadata}` +
        `KULLANICININ YENİ EKLEDİĞİ HAM NOT METNİ:\n` +
        `"${content.trim()}"\n\n` +
        `Lütfen yukarıdaki kurallara ve tez anayasasına sadık kalarak, bu notu analiz et, entegrasyon önerisini ve atıf künyesini üret.`;

      const geminiResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
        },
      });

      if (geminiResponse.text) {
        aiContextSuggestions = geminiResponse.text.trim();
      }
    } catch (geminiErr) {
      console.error(
        "Failed to generate AI context suggestions for note:",
        geminiErr,
      );
    }

    const [newNote] = await db
      .insert(notes)
      .values({
        referenceId,
        content: content.trim(),
        embedding: embeddingVector,
        aiContextSuggestions,
      })
      .returning();

    return {
      success: true,
      noteId: newNote.id,
    };
  } catch (error: any) {
    console.error("Save Note Error: ", error);
    return {
      success: false,
      error: error.message || "Not kaydedilirken bir hata oluştu.",
    };
  }
}

export interface GetNotesResult {
  success: boolean;
  error?: string;
  notes?: Array<{
    id: number;
    referenceId: number | null;
    content: string;
    aiContextSuggestions: string | null;
    isUserNote: boolean | null;
    createdAt: Date | null;
  }>;
}

/**
 * Server Action to fetch all notes associated with a given reference.
 */
export async function getNotesAction(
  referenceId: number,
): Promise<GetNotesResult> {
  try {
    const allNotes = await db
      .select({
        id: notes.id,
        referenceId: notes.referenceId,
        content: notes.content,
        aiContextSuggestions: notes.aiContextSuggestions,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(eq(notes.referenceId, referenceId))
      .orderBy(notes.createdAt);

    const notesWithUserFlag = allNotes.map((n) => ({
      id: n.id,
      referenceId: n.referenceId,
      content: n.content,
      aiContextSuggestions: n.aiContextSuggestions,
      isUserNote: true,
      createdAt: n.createdAt,
    }));

    return {
      success: true,
      notes: notesWithUserFlag,
    };
  } catch (error: any) {
    console.error("Get Notes Error: ", error);
    return {
      success: false,
      error: error.message || "Notlar listelenirken bir hata oluştu.",
    };
  }
}
