import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  date,
  vector,
  index,
} from "drizzle-orm/pg-core";

// 1. TEZ ÖZÜ TABLOSU (Tez Anayasası)
// Kullanıcının onboarding sürecinde belirlediği merkezi stratejik parametreleri tutar.
export const thesisCore = pgTable("thesis_core", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  researchQuestion: text("research_question").notNull(),
  argument: text("argument").notNull(),
  methodology: text("methodology").notNull(),
  academicRecommendations: text("academic_recommendations"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 1.1. TEZ KUTULARI TABLOSU (Tematik Kartoteks / Fişleme Kutuları)
// Kullanıcının onboarding veya dashboard sürecinde oluşturacağı esnek tematik klasörleri/kutuları tutar.
export const thesisBoxes = pgTable("thesis_boxes", {
  id: serial("id").primaryKey(),
  thesisCoreId: integer("thesis_core_id")
    .references(() => thesisCore.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. KAYNAKLAR TABLOSU (Kütüphane Künyeleri)
// Cloudflare R2'ye yüklenen dökümanların ve otomatik çekilen metadata bilgilerinin tutulduğu yerdir.
export const references = pgTable("references", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  authors: varchar("authors", { length: 255 }),
  year: integer("year"),
  doi: varchar("doi", { length: 100 }),
  pdfUrl: text("pdf_url").notNull(), // Cloudflare R2 üzerindeki kalıcı erişim adresi
  abstract: text("abstract"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. OKUMA NOTLARI TABLOSU (Kullanıcı Kişisel Not Laboratuvarı)
// Kullanıcının kendi aldığı toplu notları saklar.
export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    referenceId: integer("reference_id").references(() => references.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(), // Ham metin içeriği (Kullanıcı okuma notu)
    embedding: vector("embedding", { dimensions: 1536 }), // gemini-embedding-2 modelinden dönecek 1536 boyutlu vektör çıktısı
    aiContextSuggestions: text("ai_context_suggestions"), // Gemini'dan gelen bağlam/atıf önerileri
    boxId: integer("box_id").references(() => thesisBoxes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("notes_embedding_hnsw_index").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// 3.1. PDF PARÇALARI TABLOSU (RAG Mimarisi Semantik Arama Kalbi)
// LlamaParse'tan gelen makale parçalarını (chunks) saklar.
export const pdfChunks = pgTable(
  "pdf_chunks",
  {
    id: serial("id").primaryKey(),
    referenceId: integer("reference_id").references(() => references.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(), // Ham metin içeriği (Makale parçası)
    embedding: vector("embedding", { dimensions: 1536 }), // gemini-embedding-2 modelinden dönecek 1536 boyutlu vektör çıktısı
    boxId: integer("box_id").references(() => thesisBoxes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("pdf_chunks_embedding_hnsw_index").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// 4. GÖREVLER TABLOSU (Haftalık Planlayıcı ve Kanban)
// Sistem tarafından atanan veya kullanıcı tarafından eklenen görevlerin takibini yapar.
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  taskDescription: text("task_description").notNull(),
  status: varchar("status", { length: 50 }).default("todo"), // 'todo', 'doing', 'done' durum değerleri
  dueDate: date("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 5. YAPAY ZEKA ÖNGÖRÜLERİ TABLOSU (Fikir Sepeti)
// Danışman Odası'nda kullanıcının yıldızlayarak sepetine eklediği hocaya ait parlak fikirleri saklar.
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").references(() => notes.id, {
    onDelete: "set null",
  }), // Fikrin ilham aldığı kaynak not ile ilişkisi
  insightText: text("insight_text").notNull(), // Hocanın ürettiği o özgün akademik analiz/öneri metni
  aiContextSuggestions: text("ai_context_suggestions"), // Fikir Keskinleştirici'den gelen 3 maddelik akademik içgörü
  createdAt: timestamp("created_at").defaultNow(),
});
