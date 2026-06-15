import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  AnyPgColumn,
  boolean,
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
 */
export const thesisMatrices = pgTable("thesis_matrices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  studyTitle: varchar("study_title", { length: 500 }).notNull(),
  researchQuestion: text("research_question").notNull(),
  mainClaim: text("main_claim").notNull(),
  methodology: text("methodology").notNull(),
  theoreticalFramework: text("theoretical_framework").notNull(),
  historicalSpatialLimits: text("historical_spatial_limits").notNull(),
  keywords: jsonb("keywords").$type<string[]>().default([]).notNull(),
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
          subject: "OVERLAPPING" | "ORIGINAL";
          theory: "OVERLAPPING" | "ORIGINAL";
          methodology: "OVERLAPPING" | "ORIGINAL";
          context?: "OVERLAPPING" | "ORIGINAL";
        };
        originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
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

/**
 * Tez Kutusu Kategorisi enumu.
 * Tez kutularının hangi akademik alana ait olduğunu kısıtlar.
 */
export const thesisBoxCategoryEnum = pgEnum("thesis_box_category", [
  "intro",
  "theory",
  "methodology",
  "context",
  "primary_source",
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
 * Tez Kutuları (Outline / Box) tablosu.
 * Tez matrisine bağlı ana ve alt kutuları outline yapısında saklar.
 * parentId ile kendi kendine (self-reference) bağlanarak hiyerarşik yapı kurar.
 */
export const thesisBoxes = pgTable("thesis_boxes", {
  id: serial("id").primaryKey(),
  thesisMatrixId: integer("thesis_matrix_id")
    .notNull()
    .references(() => thesisMatrices.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references((): AnyPgColumn => thesisBoxes.id, {
    onDelete: "cascade",
  }),
  category: thesisBoxCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  theorists: jsonb("theorists").$type<string[]>().default([]).notNull(),
  concepts: jsonb("concepts").$type<string[]>().default([]).notNull(),
  queries: jsonb("queries").$type<string[]>().default([]).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Veri tabanından okunan tez kutusu tipi (select). */
export type ThesisBox = InferSelectModel<typeof thesisBoxes>;

/** Yeni tez kutusu oluşturma tipi (insert). */
export type NewThesisBox = InferInsertModel<typeof thesisBoxes>;

/**
 * Kütüphane Kaynakları tablosu.
 * Her bir tez kutusuna (box'a) önerilen / onaylanan / reddedilen
 * akademik kaynakları (makale, kitap, tez vb.) saklar.
 */
export const libraryResources = pgTable("library_resources", {
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
});

/** Veri tabanından okunan kütüphane kaynağı tipi (select). */
export type LibraryResource = InferSelectModel<typeof libraryResources>;

/** Yeni kütüphane kaynağı oluşturma tipi (insert). */
export type NewLibraryResource = InferInsertModel<typeof libraryResources>;
