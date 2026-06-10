import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * Kullanıcı tablosu.
 * E-posta benzersizdir ve şifre bcrypt-ts ile hashlenerek saklanır.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
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

/**
 * Onboarding Aşama Durumu tablosu.
 * Kullanıcının onboarding sürecinde hangi adımda olduğunu,
 * tamamlanan adımları ve sürecin bitip bitmediğini stateful
 * olarak takip eder.
 */
export const onboardingStates = pgTable("onboarding_states", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  currentStep: varchar("current_step", { length: 50 })
    .notNull()
    .default("thesis_matrix"),
  completedSteps: text("completed_steps").array().notNull().default([]),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
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

/** Veri tabanından okunan onboarding durumu tipi (select). */
export type OnboardingState = InferSelectModel<typeof onboardingStates>;

/** Yeni onboarding durumu oluşturma tipi (insert). */
export type NewOnboardingState = InferInsertModel<typeof onboardingStates>;
