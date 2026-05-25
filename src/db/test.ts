import { config } from "dotenv";
import { db } from "./index";
import { thesisCore, tasks, notes, references, pdfChunks } from "./schema";
import { sql } from "drizzle-orm";

// Load env variables
config({ path: ".env.local" });

async function runTest() {
  console.log("🚀 --- DATABASE LAYER TEST ---");

  // 1. Test inserting into thesis_core
  console.log("1️⃣ Inserting into thesis_core...");
  const [newThesis] = await db
    .insert(thesisCore)
    .values({
      title: "Siyaset Biliminde Yapay Zeka",
      researchQuestion: "Yapay zeka siyasi karar almayı nasıl etkiler?",
      argument:
        "Yapay zeka, karar almayı hızlandırır ancak demokratik meşruiyeti sorgulatabilir.",
      methodology: "Niteliksel karşılaştırmalı analiz",
    })
    .returning();

  console.log("✅ Thesis Core Inserted:", newThesis);

  // 2. Test inserting into references
  console.log("2️⃣ Inserting into references...");
  const [newReference] = await db
    .insert(references)
    .values({
      title: "Artificial Intelligence and Siyasat",
      authors: "John Doe",
      year: 2025,
      doi: "10.1000/xyz123",
      pdfUrl: "https://r2.fabricca.com/ai_and_siyasat.pdf",
      abstract: "Bu makale siyaset bilimi ve AI ilişkisini ele almaktadır.",
    })
    .returning();

  console.log("✅ Reference Inserted:", newReference);

  // 3. Test inserting into notes and pdf_chunks with embedding vector (1536 dimensions)
  console.log(
    "3️⃣ Inserting into notes and pdf_chunks with 1536-dimensional vector...",
  );

  // Create a mock 1536-dimensional embedding vector
  const dummyEmbedding = Array.from({ length: 1536 }, (_, i) =>
    i === 42 ? 0.99 : 0.01,
  );
  const targetEmbedding = Array.from({ length: 1536 }, (_, i) =>
    i === 42 ? 0.95 : 0.02,
  );

  const [newNote] = await db
    .insert(notes)
    .values({
      referenceId: newReference.id,
      content:
        "Bu kullanıcının el yazısı olan okuma notudur. Siyaset ve AI üzerine.",
      embedding: dummyEmbedding,
    })
    .returning();

  console.log("✅ Note with embedding inserted! Note ID:", newNote.id);

  const [newChunk] = await db
    .insert(pdfChunks)
    .values({
      referenceId: newReference.id,
      content: "Bu LlamaParse tarafından parçalanan ham makale parçasıdır.",
      embedding: dummyEmbedding,
    })
    .returning();

  console.log("✅ PDF Chunk with embedding inserted! Chunk ID:", newChunk.id);

  // 4. Test cosine similarity search query on pdf_chunks (RAG semantic search)
  console.log(
    "4️⃣ Performing pgvector Similarity Search on pdf_chunks using cosine distance...",
  );
  const similarChunks = await db
    .select({
      id: pdfChunks.id,
      content: pdfChunks.content,
      similarity: sql<number>`1 - (${pdfChunks.embedding} <=> ${JSON.stringify(targetEmbedding)}::vector)`,
    })
    .from(pdfChunks)
    .orderBy(
      sql`${pdfChunks.embedding} <=> ${JSON.stringify(targetEmbedding)}::vector`,
    )
    .limit(1);

  console.log("✅ Similar chunks found:", similarChunks);

  // 5. Test inserting into tasks
  console.log("5️⃣ Inserting into tasks...");
  const [newTask] = await db
    .insert(tasks)
    .values({
      taskDescription: "Siyaset ve AI literatürünü gözden geçir",
      status: "doing",
      dueDate: "2026-06-01",
    })
    .returning();

  console.log("✅ Task Inserted:", newTask);

  // 6. Clean up test records (to keep DB clean and test cascades)
  console.log("6️⃣ Cleaning up test records (testing cascade delete)...");
  await db.delete(thesisCore).where(sql`${thesisCore.id} = ${newThesis.id}`);
  await db.delete(tasks).where(sql`${tasks.id} = ${newTask.id}`);
  await db.delete(references).where(sql`${references.id} = ${newReference.id}`); // Cascade deletes note

  console.log("✅ Cleanup completed successfully!");
  console.log("🎉 --- ALL DATABASE LAYER TESTS PASSED SUCCESSFULLY! ---");
}

runTest().catch((e) => {
  console.error("❌ Test failed with error:", e);
  process.exit(1);
});
