import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
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
