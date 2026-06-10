import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * Kullanıcı tablosu.
 * E-posta benzersizdir ve şifre bcrypt-ts ile hashlenerek saklanır.
 * onboardingStep alanı, onboarding sürecinin hangi adımda olduğunu
 * ('thesis_matrix' | 'thesis_matrix_enhanced' | 'completed') tutar.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  onboardingStep: varchar("onboarding_step", { length: 50 })
    .notNull()
    .default("thesis_matrix"),
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
  calismaBasligi: varchar("calisma_basligi", { length: 500 }).notNull(),
  arastirmaSorusu: text("arastirma_sorusu").notNull(),
  temelIddia: text("temel_iddia").notNull(),
  metodoloji: text("metodoloji").notNull(),
  kuramsalCerceve: text("kuramsal_cerceve").notNull(),
  tarihselMekansalSinirlar: text("tarihsel_mekansal_sinirlar").notNull(),
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
        result: string;
        sourceUrl: string;
      }[];
      briefingNote: string;
    }>()
    .notNull(),
  tezaraResults: jsonb("tezara_results")
    .$type<{
      originalityBadge: "YÜKSEK" | "ORTA" | "DÜŞÜK";
      overlapTable: {
        id: number;
        title: string;
        author: string;
        university: string;
        year: number;
        thesisType: string;
        department: string;
        axes: {
          subject: string;
          theory: string;
          methodology: string;
          context: string;
        };
        originalityLevel: "YÜKSEK" | "ORTA" | "DÜŞÜK";
      }[];
      strategicRecommendations: string;
    }>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Veri tabanından okunan özgünlük raporu tipi (select). */
export type OriginalityReport = InferSelectModel<typeof originalityReports>;

/** Yeni özgünlük raporu oluşturma tipi (insert). */
export type NewOriginalityReport = InferInsertModel<typeof originalityReports>;
