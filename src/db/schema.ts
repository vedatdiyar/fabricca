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
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import {
  relations,
  type InferSelectModel,
  type InferInsertModel,
} from "drizzle-orm";
import type {
  PositioningMatrixInput,
  RecommendedThesisItem,
  GapAnalysisStructured,
} from "@/app/(onboarding)/onboarding/positioning/_lib/validation";

// ============================================================================
// A) USERS
// ============================================================================

/**
 * Users table.
 * Email is unique and the password is hashed using bcrypt-ts.
 * The onboardingCompleted field indicates whether the user has completed onboarding.
 */
export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  onboardingCompleted: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});

/** User type for select queries. */
export type User = InferSelectModel<typeof users>;

/** User type for insert queries. */
export type NewUser = InferInsertModel<typeof users>;

// ============================================================================
// B) THESIS MATRICES
// ============================================================================

/**
 * Thesis Matrix table.
 * Stores subjectProblem, theoreticalFramework, primaryMaterial,
 * and methodology filled by the user during the first step of onboarding.
 */
export const thesisMatrices = pgTable("thesis_matrices", {
  id: serial().primaryKey(),
  userId: integer()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  subjectProblem: text("subject_problem").notNull(),
  theoreticalFramework: text("theoretical_framework").notNull(),
  primaryMaterial: text("primary_material"),
  methodology: text("methodology").notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

/** ThesisMatrix type for select queries. */
export type ThesisMatrix = InferSelectModel<typeof thesisMatrices>;

/** ThesisMatrix type for insert queries. */
export type NewThesisMatrix = InferInsertModel<typeof thesisMatrices>;

// ============================================================================
// C) THESIS POSITIONING
// ============================================================================

export const positioningGlobalStatusEnum = pgEnum("positioning_global_status", [
  "DIRECT_OVERLAP",
  "NOVEL_GAP_IDENTIFIED",
  "NO_RELATED_LITERATURE",
]);

/**
 * Thesis Positioning table.
 * Stores universal positioning matrix input, AI gap analysis synthesis,
 * global positioning status, and recommended guiding theses.
 */
export const thesisPositioning = pgTable(
  "thesis_positioning",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    matrixInput: jsonb("matrix_input")
      .$type<PositioningMatrixInput>()
      .notNull(),
    globalStatus: positioningGlobalStatusEnum("global_status"),
    gapAnalysisSummary: jsonb("gap_analysis_summary").$type<
      GapAnalysisStructured | string
    >(),
    recommendedTheses: jsonb("recommended_theses")
      .$type<RecommendedThesisItem[]>()
      .default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_thesis_positioning_user_id").on(table.userId)],
);

/** ThesisPositioning type for select queries. */
export type ThesisPositioning = InferSelectModel<typeof thesisPositioning>;

/** NewThesisPositioning type for insert queries. */
export type NewThesisPositioning = InferInsertModel<typeof thesisPositioning>;

// ============================================================================
// D) THESIS BOXES
// ============================================================================

export const boxTypeEnum = pgEnum("box_type_enum", [
  "SUBJECT_PROBLEM",
  "THEORETICAL_FRAMEWORK",
  "PRIMARY_MATERIAL",
  "METHODOLOGY",
]);

/**
 * Thesis Boxes table.
 * Stores topic boxes linked to a thesis matrix in a flat structure.
 */
export const thesisBoxes = pgTable(
  "thesis_boxes",
  {
    id: serial().primaryKey(),
    thesisMatrixId: integer()
      .notNull()
      .references(() => thesisMatrices.id, { onDelete: "cascade" }),
    parentId: integer(),
    boxType: boxTypeEnum("box_type"),
    title: text().notNull(),
    description: text(),
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
    index("idx_thesis_boxes_parent_id").on(table.parentId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("cascade"),
  ],
);

/** ThesisBox type for select queries. */
export type ThesisBox = InferSelectModel<typeof thesisBoxes>;

/** ThesisBox type for insert queries. */
export type NewThesisBox = InferInsertModel<typeof thesisBoxes>;

// ============================================================================
// E) LIBRARY RESOURCES
// ============================================================================

export const pdfStatusEnum = pgEnum("pdf_status_enum", [
  "NOT_UPLOADED",
  "PROCESSING",
  "READY",
  "FAILED",
]);

export const noteTypeEnum = pgEnum("note_type_enum", [
  "DIRECT_QUOTE",
  "PARAPHRASE",
  "PERSONAL_NOTE",
]);

/**
 * Library Resources table.
 * Stores recommended / approved / rejected academic sources
 * (articles, books, theses, etc.) linked to each thesis box.
 */
export const libraryResources = pgTable(
  "library_resources",
  {
    id: serial().primaryKey(),
    thesisBoxId: integer()
      .notNull()
      .references(() => thesisBoxes.id, { onDelete: "cascade" }),
    title: text().notNull(),
    authors: text().array(),
    publisher: text(),
    publicationYear: integer(),
    doi: text(),
    url: text(),
    relevanceScore: real(),
    badge: varchar({ length: 50 }),
    comparisonNote: text(),
    isRead: boolean().default(false).notNull(),
    isFoundational: boolean().default(false).notNull(),
    pdfUrl: text("pdf_url"),
    pdfFileName: text("pdf_file_name"),
    pdfFileSize: integer("pdf_file_size"),
    pdfStatus: pdfStatusEnum("pdf_status").default("NOT_UPLOADED").notNull(),
    pageCount: integer("page_count"),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
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

/** LibraryResource type for select queries. */
export type LibraryResource = InferSelectModel<typeof libraryResources>;

/** LibraryResource type for insert queries. */
export type NewLibraryResource = InferInsertModel<typeof libraryResources>;

/**
 * Library Resource Notes table.
 * Stores academic notes, page-numbered citations, and personal notes.
 */
export const libraryResourceNotes = pgTable(
  "library_resource_notes",
  {
    id: serial().primaryKey(),
    libraryResourceId: integer("library_resource_id")
      .notNull()
      .references(() => libraryResources.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageNumber: varchar("page_number", { length: 50 }).notNull(),
    noteType: noteTypeEnum("note_type").notNull(),
    content: text("content").notNull(),
    sentToCardIndex: boolean("sent_to_card_index").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_library_resource_notes_resource_id").on(table.libraryResourceId),
    index("idx_library_resource_notes_user_id").on(table.userId),
  ],
);

/** LibraryResourceNote type for select queries. */
export type DbLibraryResourceNote = InferSelectModel<
  typeof libraryResourceNotes
>;

/** NewLibraryResourceNote type for insert queries. */
export type NewDbLibraryResourceNote = InferInsertModel<
  typeof libraryResourceNotes
>;

/**
 * Resource Embeddings table.
 */
export const resourceEmbeddings = pgTable(
  "resource_embeddings",
  {
    id: serial().primaryKey(),
    libraryResourceId: integer("library_resource_id")
      .notNull()
      .references(() => libraryResources.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_resource_embeddings_resource_id").on(table.libraryResourceId),
    index("idx_resource_embeddings_embedding").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

/** ResourceEmbedding type for select queries. */
export type ResourceEmbedding = InferSelectModel<typeof resourceEmbeddings>;

/** NewResourceEmbedding type for insert queries. */
export type NewResourceEmbedding = InferInsertModel<typeof resourceEmbeddings>;

// ============================================================================
// G) PENDING UPLOADS (presigned URL flow — Vercel Hobby 4.5MB bypass)
// ============================================================================

/**
 * Pending Uploads table.
 * Stores metadata for in-progress direct-to-R2 uploads.
 * Records are created in Step 1 (request upload URL) and consumed in Step 2 (complete upload).
 * Expired records are cleaned up by the complete action after successful processing.
 */
export const pendingUploads = pgTable(
  "pending_uploads",
  {
    id: serial().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tempKey: text("temp_key").notNull().unique(),
    boxType: text("box_type"),
    originalFileName: text("original_file_name"),
    contentType: text("content_type").default("application/pdf").notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    index("idx_pending_uploads_user_id").on(table.userId),
    index("idx_pending_uploads_temp_key").on(table.tempKey),
  ],
);

/** PendingUpload type for select queries. */
export type PendingUpload = InferSelectModel<typeof pendingUploads>;

/** PendingUpload type for insert queries. */
export type NewPendingUpload = InferInsertModel<typeof pendingUploads>;

// ============================================================================
// H) TASKS
// ============================================================================

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

/**
 * Kanban Tasks table.
 * Stores academic tasks manually added by the user.
 * Dynamically linked to thesis boxes via thesisBoxId;
 * when a box is deleted, the task is preserved (SET NULL).
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
  (table) => [
    index("idx_tasks_user_id").on(table.userId),
    index("idx_tasks_thesis_box_id").on(table.thesisBoxId),
  ],
);

/** Task type for select queries. */
export type Task = InferSelectModel<typeof tasks>;

/** Task type for insert queries. */
export type NewTask = InferInsertModel<typeof tasks>;

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  thesisMatrix: one(thesisMatrices),
  thesisPositioning: one(thesisPositioning),
  tasks: many(tasks),
}));

export const thesisPositioningRelations = relations(
  thesisPositioning,
  ({ one }) => ({
    user: one(users, {
      fields: [thesisPositioning.userId],
      references: [users.id],
    }),
  }),
);

export const thesisMatricesRelations = relations(
  thesisMatrices,
  ({ one, many }) => ({
    user: one(users, {
      fields: [thesisMatrices.userId],
      references: [users.id],
    }),
    thesisBoxes: many(thesisBoxes),
  }),
);

export const thesisBoxesRelations = relations(thesisBoxes, ({ one, many }) => ({
  thesisMatrix: one(thesisMatrices, {
    fields: [thesisBoxes.thesisMatrixId],
    references: [thesisMatrices.id],
  }),
  parent: one(thesisBoxes, {
    fields: [thesisBoxes.parentId],
    references: [thesisBoxes.id],
    relationName: "boxHierarchy",
  }),
  children: many(thesisBoxes, {
    relationName: "boxHierarchy",
  }),
  libraryResources: many(libraryResources),
  tasks: many(tasks),
}));

export const libraryResourcesRelations = relations(
  libraryResources,
  ({ one }) => ({
    thesisBox: one(thesisBoxes, {
      fields: [libraryResources.thesisBoxId],
      references: [thesisBoxes.id],
    }),
  }),
);

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  thesisBox: one(thesisBoxes, {
    fields: [tasks.thesisBoxId],
    references: [thesisBoxes.id],
  }),
}));
