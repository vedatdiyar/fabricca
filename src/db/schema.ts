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
  customType,
} from "drizzle-orm/pg-core";
import {
  sql,
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
export const matrices = pgTable("matrices", {
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

/** Matrix type for select queries. */
export type Matrix = InferSelectModel<typeof matrices>;

/** Matrix type for insert queries. */
export type NewMatrix = InferInsertModel<typeof matrices>;

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
export const positioning = pgTable(
  "positioning",
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
  (table) => [uniqueIndex("idx_positioning_user_id").on(table.userId)],
);

/** Positioning type for select queries. */
export type Positioning = InferSelectModel<typeof positioning>;

/** NewPositioning type for insert queries. */
export type NewPositioning = InferInsertModel<typeof positioning>;

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
export const boxes = pgTable(
  "boxes",
  {
    id: serial().primaryKey(),
    matrixId: integer()
      .notNull()
      .references(() => matrices.id, { onDelete: "cascade" }),
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
    index("idx_boxes_matrix_id").on(table.matrixId),
    index("idx_boxes_parent_id").on(table.parentId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("cascade"),
  ],
);

/** Box type for select queries. */
export type Box = InferSelectModel<typeof boxes>;

/** Box type for insert queries. */
export type NewBox = InferInsertModel<typeof boxes>;

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
export const sources = pgTable(
  "sources",
  {
    id: serial().primaryKey(),
    boxId: integer()
      .notNull()
      .references(() => boxes.id, { onDelete: "cascade" }),
    title: text().notNull(),
    authors: text().array(),
    publisher: text(),
    publicationYear: integer(),
    doi: text(),
    openalexId: text("openalex_id"),
    relevanceScore: real(),
    comparisonNote: text(),
    isRead: boolean().default(false).notNull(),
    isFoundational: boolean().default(false).notNull(),
    pdfUrl: text("pdf_url"),
    pdfFileName: text("pdf_file_name"),
    pdfFileSize: integer("pdf_file_size"),
    pdfStatus: pdfStatusEnum("pdf_status").default("NOT_UPLOADED").notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_sources_box_doi").on(table.boxId, table.doi),
    uniqueIndex("idx_sources_box_title").on(table.boxId, table.title),
  ],
);

/** Source type for select queries. */
export type Source = InferSelectModel<typeof sources>;

/** Source type for insert queries. */
export type NewSource = InferInsertModel<typeof sources>;

/**
 * Notes table.
 * Stores academic notes, page-numbered citations, and personal notes.
 */
export const notes = pgTable(
  "notes",
  {
    id: serial().primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
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
    index("idx_notes_source_id").on(table.sourceId),
    index("idx_notes_user_id").on(table.userId),
  ],
);

/** Note type for select queries. */
export type Note = InferSelectModel<typeof notes>;

/** NewNote type for insert queries. */
export type NewNote = InferInsertModel<typeof notes>;

/**
 * PostgreSQL `tsvector` custom type.
 * Drizzle ORM 0.43 does not ship a native tsvector column, so it is declared
 * via `customType` for the generated `search_vector` column on the chunks table.
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Chunks table.
 * Stores PDF text chunks with embeddings for RAG retrieval.
 *
 * `search_vector` is a stored generated column driving the lexical branch of the
 * hybrid RAG pipeline. It is language-neutral (`simple` config — no stemming) so
 * Turkish/English mixed corpora are handled deterministically while preserving
 * exact lexical signals (names, institutions, acronyms, dates, DOIs, terms).
 * Weighting: B = section title, C = chunk content.
 */
export const chunks = pgTable(
  "chunks",
  {
    id: serial().primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    printedPageNumber: integer("printed_page_number"),
    pdfPageNumber: integer("pdf_page_number"),
    sectionTitle: text("section_title"),
    content: text("content").notNull(),
    parentContent: text("parent_content"),
    tokenCount: integer("token_count"),
    embedding: vector("embedding", { dimensions: 1024 }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce("section_title", '')), 'B') || setweight(to_tsvector('simple', "content"), 'C')`,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_chunks_source_id").on(table.sourceId),
    index("idx_chunks_embedding").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("idx_chunks_search_vector").using("gin", table.searchVector),
  ],
);

/** Chunk type for select queries. */
export type Chunk = InferSelectModel<typeof chunks>;

/** NewChunk type for insert queries. */
export type NewChunk = InferInsertModel<typeof chunks>;

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
 * Dynamically linked to boxes via boxId;
 * when a box is deleted, the task is preserved (SET NULL).
 */
export const tasks = pgTable(
  "tasks",
  {
    id: serial().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boxId: integer().references(() => boxes.id, {
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
    index("idx_tasks_box_id").on(table.boxId),
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
  matrix: one(matrices),
  positioning: one(positioning),
  tasks: many(tasks),
}));

export const positioningRelations = relations(positioning, ({ one }) => ({
  user: one(users, {
    fields: [positioning.userId],
    references: [users.id],
  }),
}));

export const matricesRelations = relations(matrices, ({ one, many }) => ({
  user: one(users, {
    fields: [matrices.userId],
    references: [users.id],
  }),
  boxes: many(boxes),
}));

export const boxesRelations = relations(boxes, ({ one, many }) => ({
  matrix: one(matrices, {
    fields: [boxes.matrixId],
    references: [matrices.id],
  }),
  parent: one(boxes, {
    fields: [boxes.parentId],
    references: [boxes.id],
    relationName: "boxHierarchy",
  }),
  children: many(boxes, {
    relationName: "boxHierarchy",
  }),
  sources: many(sources),
  tasks: many(tasks),
}));

export const sourcesRelations = relations(sources, ({ one }) => ({
  box: one(boxes, {
    fields: [sources.boxId],
    references: [boxes.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  box: one(boxes, {
    fields: [tasks.boxId],
    references: [boxes.id],
  }),
}));
