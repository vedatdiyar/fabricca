"use server";

import { db } from "@/db";
import { references, pdfChunks, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  generateUniqueR2Key,
  uploadPdfToR2,
  generatePresignedUrl,
} from "../_services/r2.service";
import { parsePdfWithLlamaParse } from "../_services/llamaparse.service";
import { splitMarkdownIntoChunks } from "../_utils/text-splitters";
import { generateEmbedding } from "../_services/embedding.service";
import { extractAcademicMetadata } from "../_services/metadata.service";

export interface UploadResult {
  success: boolean;
  error?: string;
  key?: string;
  pdfUrl?: string;
  fileName?: string;
  fileSize?: number;
  referenceId?: number;
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
    const key = generateUniqueR2Key(file.name);

    // 2. Read file as ArrayBuffer and convert to Buffer for S3 upload compatibility
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload file to Cloudflare R2
    await uploadPdfToR2(key, buffer);

    // 4. Save metadata in the database references table
    const [newRef] = await db
      .insert(references)
      .values({
        title: file.name.replace(".pdf", ""),
        pdfUrl: key, // Storing R2 unique key as pdfUrl reference pointer
      })
      .returning();

    // Automatically create a reading task for the uploaded PDF in 'todo' status
    await db.insert(tasks).values({
      taskDescription: `Makale Okuma: ${newRef.title}`,
      status: "todo",
    });

    // 5. Generate a secure presigned GET URL for LlamaParse ingestion (valid for 24 hours)
    const presignedUrl = await generatePresignedUrl(key);

    // 6. Run LlamaParse v2 + LangChain splitters + Gemini embeddings sequentially
    try {
      console.log(`Starting parsing pipeline for referenceId: ${newRef.id}...`);

      // 1. Parse via LlamaParse Service
      const fullMarkdown = await parsePdfWithLlamaParse(presignedUrl);

      // 2. LangChain splitting via Utility helper
      const finalChunks = await splitMarkdownIntoChunks(fullMarkdown);

      // 3. Generate embeddings and store them
      const insertValues = [];

      for (let i = 0; i < finalChunks.length; i++) {
        const chunkText = finalChunks[i].pageContent;
        if (!chunkText || !chunkText.trim()) continue;

        const formattedText = `title: none | text: ${chunkText}`;
        const embeddingVector = await generateEmbedding(formattedText);

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

      // 7. Academic Metadata Extraction via Metadata Service
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
    } catch (pipelineError) {
      console.error("LlamaParse/LangChain RAG Pipeline Error: ", pipelineError);
      throw new Error(
        `Dosya yüklendi fakat RAG analizi başarısız oldu: ${pipelineError instanceof Error ? pipelineError.message : "Bilinmeyen hata"}`,
      );
    }

    return {
      success: true,
      key,
      pdfUrl: presignedUrl,
      fileName: file.name,
      fileSize: file.size,
      referenceId: newRef.id,
    };
  } catch (error) {
    console.error("R2 Upload Error: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Dosya yüklenirken bilinmeyen bir hata oluştu.",
    };
  }
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
        let url = "";
        try {
          url = await generatePresignedUrl(ref.pdfUrl);
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
  } catch (error) {
    console.error("Failed to get references: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Kaynaklar listelenirken bir hata oluştu.",
    };
  }
}
