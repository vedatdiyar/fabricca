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

/** A single parsed bibliographic reference extracted from a resource's reference list. */
export interface ParsedReference {
  raw: string;
  title: string | null;
  authors: string[];
  year: number | null;
  journal: string | null;
  resolved: boolean;
}

/** Users table — email is unique, password is bcrypt-hashed, onboardingCompleted tracks onboarding state. */
export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  onboardingCompleted: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});

export type User = InferSelectModel<typeof users>;

export type NewUser = InferInsertModel<typeof users>;

/** Thesis Matrix table — stores subjectProblem, theoreticalFramework, primaryMaterial, and methodology from the first onboarding step. */
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

export type Matrix = InferSelectModel<typeof matrices>;

export type NewMatrix = InferInsertModel<typeof matrices>;

export const positioningGlobalStatusEnum = pgEnum("positioning_global_status", [
  "DIRECT_OVERLAP",
  "NOVEL_GAP_IDENTIFIED",
  "NO_RELATED_LITERATURE",
]);

/** Thesis Positioning table — stores matrix input, AI gap analysis, global status, and recommended guiding theses. */
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

export type Positioning = InferSelectModel<typeof positioning>;

export type NewPositioning = InferInsertModel<typeof positioning>;

export const boxTypeEnum = pgEnum("box_type_enum", [
  "SUBJECT_PROBLEM",
  "THEORETICAL_FRAMEWORK",
  "PRIMARY_MATERIAL",
  "METHODOLOGY",
]);

/** Thesis Boxes table — stores topic boxes linked to a thesis matrix in a flat structure. */
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

export type Box = InferSelectModel<typeof boxes>;

export type NewBox = InferInsertModel<typeof boxes>;

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

/** Library Resources table — stores recommended / approved / rejected academic sources linked to each thesis box. */
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
    parsedReferences: jsonb("parsed_references").$type<ParsedReference[]>(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [index("idx_sources_box_id").on(table.boxId)],
);

export type Source = InferSelectModel<typeof sources>;

export type NewSource = InferInsertModel<typeof sources>;

/** Notes table — stores academic notes, page-numbered citations, and personal notes. */
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
    sentToCitationCards: boolean("sent_to_citation_cards")
      .default(true)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_notes_source_id").on(table.sourceId),
    index("idx_notes_user_id").on(table.userId),
  ],
);

export type Note = InferSelectModel<typeof notes>;

export type NewNote = InferInsertModel<typeof notes>;

/** PostgreSQL tsvector via customType — Drizzle 0.43 ships no native tsvector column. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/** Chunks table — PDF text chunks with embeddings for RAG; search_vector drives the lexical branch. */
export const chunks = pgTable(
  "chunks",
  {
    id: serial().primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    parentContent: text("parent_content"),
    section: text("section"),
    headerHierarchy: text("header_hierarchy").array(),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    printedPageNumber: text("printed_page_number"),
    tokenCount: integer("token_count"),
    embedding: vector("embedding", { dimensions: 1024 }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple', "content") || to_tsvector('english', "content")`,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_chunks_source_id").on(table.sourceId),
    index("idx_chunks_search_vector").using("gin", table.searchVector),
    index("idx_chunks_embedding_hnsw").using(
      "hnsw",
      table.embedding.op("vector_ip_ops"),
    ),
  ],
);

export type Chunk = InferSelectModel<typeof chunks>;

export type NewChunk = InferInsertModel<typeof chunks>;

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

/** Kanban Tasks table — user-added academic tasks linked to boxes; preserved (SET NULL) when a box is deleted. */
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

export type Task = InferSelectModel<typeof tasks>;

export type NewTask = InferInsertModel<typeof tasks>;

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

/** Chat Sessions table — stores advisor conversation threads per user. */
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: serial().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar({ length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_chat_sessions_user_id").on(table.userId)],
);

export type ChatSession = InferSelectModel<typeof chatSessions>;

export type NewChatSession = InferInsertModel<typeof chatSessions>;

/** Chat Messages table — stores individual messages within a chat session. */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial().primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: varchar({ length: 10 }).notNull(),
    content: text("content").notNull(),
    sources: jsonb("sources").$type<RagSearchResultItem[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_chat_messages_session_id").on(table.sessionId)],
);

export type ChatMessage = InferSelectModel<typeof chatMessages>;

export type NewChatMessage = InferInsertModel<typeof chatMessages>;

/** Lightweight type for RAG source references stored in chat messages. */
export interface RagSearchResultItem {
  resourceTitle: string;
  resourceAuthors: string[];
  content: string;
  relevanceScore: number;
  denseScore: number;
  isPartialMatch: boolean;
  pageStart: number | null;
  pageEnd: number | null;
  printedPageNumber: string | null;
  sectionTitle: string | null;
}
