import type { ThesisAxes, ThesisBadge } from "@/lib/types";
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * Kullanıcı tablosu.
 * E-posta benzersizdir ve şifre bcrypt-ts ile hashlenerek saklanır.
 * onboardingCompleted alanı, onboarding sürecinin tamamlanıp tamamlanmadığını tutar.
 */
export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  onboardingCompleted: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});

/**
 * Tez Matrisi tablosu.
 * Her kullanıcının onboarding sürecinin ilk adımında doldurduğu
 * çalışma başlığı, araştırma sorusu, temel iddia, metodoloji,
 * kuramsal çerçeve ve tarihsel/mekânsal sınırlar bilgilerini tutar.
 */
export const thesisMatrices = pgTable("thesis_matrices", {
  id: serial().primaryKey(),
  userId: integer()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  studyTitle: text().notNull(),
  researchQuestion: text().notNull(),
  theoreticalFramework: text().notNull(),
  methodology: text().notNull(),
  researchScope: text().notNull(),
  mainClaim: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
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
  id: serial().primaryKey(),
  userId: integer()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  tavilyResults: jsonb()
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
  tezaraResults: jsonb()
    .$type<{
      originalityBadge: ThesisBadge;
      overlapTable: {
        id: number;
        title: string;
        author: string;
        university: string;
        year: number;
        thesisType: string;
        department: string;
        axes: ThesisAxes;
        comparisonNote?: string;
        yokPdfUrl?: string;
      }[];
      strategicRecommendations: string;
    }>()
    .notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

/** Veri tabanından okunan özgünlük raporu tipi (select). */
export type OriginalityReport = InferSelectModel<typeof originalityReports>;

/** Yeni özgünlük raporu oluşturma tipi (insert). */
export type NewOriginalityReport = InferInsertModel<typeof originalityReports>;

export const taskStatusEnum = pgEnum("task_status", [
  "TODO",
  "IN_PROGRESS",
  "DONE",
]);
export const taskPriorityEnum = pgEnum("task_priority", [
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const boxTypeEnum = pgEnum("box_type_enum", [
  "PROBLEMATIZATION",
  "CONCEPTUAL",
  "DATA_PROTOCOL",
  "PRIMARY_MATERIAL",
  "CONTEXT",
  "RELATED_THESES",
]);

/**
 * Tez Kutuları (Box) tablosu.
 * Tez matrisine bağlı konu kutularını düz (flat) yapıda saklar.
 */
export const thesisBoxes = pgTable(
  "thesis_boxes",
  {
    id: serial().primaryKey(),
    thesisMatrixId: integer()
      .notNull()
      .references(() => thesisMatrices.id, { onDelete: "cascade" }),
    title: text().notNull(),
    boxType: boxTypeEnum("box_type"),
    description: text(),
    parentId: integer(),
    semanticQuery: text(),
    concepts: jsonb().$type<string[]>().default([]).notNull(),
    foundationalQueries: jsonb()
      .$type<{ author: string; title: string; publicationYear: number }[]>()
      .default([])
      .notNull(),

    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    index("idx_thesis_boxes_matrix_id").on(table.thesisMatrixId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("cascade"),
  ],
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
    id: serial().primaryKey(),
    thesisBoxId: integer()
      .notNull()
      .references(() => thesisBoxes.id, { onDelete: "cascade" }),
    title: text().notNull(),
    abstract: text(),
    url: text(),
    doi: text(),
    publisher: text(),
    publicationYear: integer(),
    authors: jsonb().$type<string[]>(),
    isRead: boolean().default(false),

    relevanceScore: real(),
    isFoundational: boolean().default(false).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
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

/**
 * Kanban Görevleri tablosu.
 * Kullanıcının manuel olarak eklediği akademik görevleri saklar.
 * thesisBoxId üzerinden konu kutularına dinamik bağlantılıdır;
 * kutu silinirse görev korunur (SET NULL).
 */
export const tasks = pgTable(
  "tasks",
  {
    id: serial().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    thesisBoxId: integer().references(() => thesisBoxes.id, {
      onDelete: "set null",
    }),
    title: text().notNull(),
    description: text(),
    status: taskStatusEnum("status").default("TODO").notNull(),
    priority: taskPriorityEnum("priority").default("MEDIUM").notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [index("idx_tasks_user_id").on(table.userId)],
);

/** Veri tabanından okunan görev tipi (select). */
export type Task = InferSelectModel<typeof tasks>;

/** Yeni görev oluşturma tipi (insert). */
export type NewTask = InferInsertModel<typeof tasks>;
