import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * Kullanıcı tablosu.
 * E-posta benzersizdir ve şifre bcrypt-ts ile hashlenerek saklanır.
 * onboardingCompleted alanı, onboarding sürecinin tamamlanıp tamamlanmadığını tutar.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Tez Matrisi tablosu.
 * Her kullanıcının onboarding sürecinin ilk adımında doldurduğu
 * çalışma başlığı, araştırma sorusu, temel iddia, metodoloji,
 * kuramsal çerçeve ve tarihsel/mekânsal sınırlar bilgilerini tutar.
 * Sadece zenginleştirilmiş (enriched) versiyon kaydedilir; ham form yazılmaz.
 */
export const thesisMatrices = pgTable("thesis_matrices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  studyTitle: text("study_title").notNull(),
  researchQuestion: text("research_question").notNull(),
  theoreticalFramework: text("theoretical_framework").notNull(),
  methodology: text("methodology").notNull(),
  researchScope: text("research_scope").notNull(),
  mainClaim: text("main_claim").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Veri tabanından okunan kullanıcı tipi (select). */
export type User = InferSelectModel<typeof users>;

/** Yeni kullanıcı oluşturma tipi (insert). */
export type NewUser = InferInsertModel<typeof users>;

/** Veri tabanından okunan tez matrisi tipi (select). */
export type ThesisMatrix = InferSelectModel<typeof thesisMatrices>;

/** Yeni tez matrisi oluşturma tipi (insert). */
export type NewThesisMatrix = InferInsertModel<typeof thesisMatrices>;

/**
 * Özgünlük Raporu tablosu.
 * Kullanıcının Tavily ve Tezara analiz sonuçlarını saklar.
 */
export const originalityReports = pgTable("originality_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  tavilyResults: jsonb("tavily_results")
    .$type<{
      items: {
        fact: string;
        result: "VERIFIED" | "PARTIALLY_VERIFIED" | "REFUTED" | string;
        resultNote?: string;
        sourceUrl: string;
      }[];
      briefingNote: string;
    }>()
    .notNull(),
  tezaraResults: jsonb("tezara_results")
    .$type<{
      originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
      overlapTable: {
        id: number;
        title: string;
        author: string;
        university: string;
        year: number;
        thesisType: string;
        department: string;
        axes: {
          subject: "HIGH" | "PARTIAL" | "NONE";
          theory: "HIGH" | "PARTIAL" | "NONE";
          methodology: "HIGH" | "PARTIAL" | "NONE";
          context?: "HIGH" | "PARTIAL" | "NONE";
        };
        riskScore: number;
        comparisonNote?: string;
        yokPdfUrl?: string;
      }[];
      strategicRecommendations: string;
      riskPercentage?: number;
    }>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Veri tabanından okunan özgünlük raporu tipi (select). */
export type OriginalityReport = InferSelectModel<typeof originalityReports>;

/** Yeni özgünlük raporu oluşturma tipi (insert). */
export type NewOriginalityReport = InferInsertModel<typeof originalityReports>;

export const boxTypeEnum = pgEnum("box_type_enum", [
  "PROBLEMATIZATION",
  "CONCEPTUAL",
  "DATA_PROTOCOL",
  "ANALYSIS_FINDINGS",
  "ARGUMENT_SYNTHESIS",
]);

export const literatureStatusEnum = pgEnum("literature_status_enum", [
  "SUGGESTED",
  "APPROVED",
  "RESERVED",
  "REJECTED",
]);

export const literatureTypeEnum = pgEnum("literature_type_enum", [
  "PRIMARY",
  "SECONDARY",
]);

/**
 * Tez Kutuları (Box) tablosu.
 * Tez matrisine bağlı konu kutularını düz (flat) yapıda saklar.
 */
export const thesisBoxes = pgTable(
  "thesis_boxes",
  {
    id: serial("id").primaryKey(),
    thesisMatrixId: integer("thesis_matrix_id")
      .notNull()
      .references(() => thesisMatrices.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    boxType: boxTypeEnum("box_type"),
    description: text("description"),
    semanticSearchBlock: text("semantic_search_block"),
    concepts: jsonb("concepts").$type<string[]>().default([]).notNull(),
    foundationalQueries: jsonb("foundational_queries")
      .$type<{ author: string; title: string; publicationYear: number }[]>()
      .default([])
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_thesis_boxes_matrix_id").on(table.thesisMatrixId)],
);

/** Veri tabanından okunan tez kutusu tipi (select). */
export type ThesisBox = InferSelectModel<typeof thesisBoxes>;

/** Yeni tez kutusu oluşturma tipi (insert). */
export type NewThesisBox = InferInsertModel<typeof thesisBoxes>;

/**
 * Kütüphane Kaynakları tablosu.
 * Her bir tez kutusuna (box'a) önerilen / onaylanan / reddedilen
 * akademik kaynakları (makale, kitap, tez vb.) saklar.
 */
export const libraryResources = pgTable(
  "library_resources",
  {
    id: serial("id").primaryKey(),
    thesisBoxId: integer("thesis_box_id")
      .notNull()
      .references(() => thesisBoxes.id, { onDelete: "cascade" }),
    status: literatureStatusEnum("status").default("SUGGESTED").notNull(),
    type: literatureTypeEnum("type").notNull(),
    title: text("title").notNull(),
    abstract: text("abstract"),
    url: text("url"),
    doi: text("doi"),
    publisher: text("publisher"),
    publicationYear: integer("publication_year"),
    authors: jsonb("authors").$type<string[]>(),
    strategicRecommendations: text("strategic_recommendations"),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_library_resources_box_status").on(
      table.thesisBoxId,
      table.status,
    ),
    uniqueIndex("idx_library_resources_box_doi").on(
      table.thesisBoxId,
      table.doi,
    ),
    uniqueIndex("idx_library_resources_box_title").on(
      table.thesisBoxId,
      table.title,
    ),
  ],
);

/** Veri tabanından okunan kütüphane kaynağı tipi (select). */
export type LibraryResource = InferSelectModel<typeof libraryResources>;

/** Yeni kütüphane kaynağı oluşturma tipi (insert). */
export type NewLibraryResource = InferInsertModel<typeof libraryResources>;
