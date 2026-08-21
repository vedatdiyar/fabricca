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
  foreignKey,
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
  RecommendedThesisItem,
  GapAnalysisStructured,
} from "@/app/(onboarding)/onboarding/positioning/_services/validation";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import type { ParsedReference } from "@/core/services/pdf/parsed-reference";
import type { ChatToolCall } from "@/app/(app)/advisor/_lib/types";
import type {
  PipelineResultData,
  JuryCritique,
  OfficeReviewReport,
} from "@/app/(app)/advisor/_services/pipeline/types";

export type {
  ParsedReference,
  ChatToolCall,
  PipelineResultData,
  JuryCritique,
  OfficeReviewReport,
  RagSearchResultItem,
};

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

/** Thesis Positioning table — stores AI gap analysis, global status, and recommended guiding theses linked to thesis matrix. */
export const positioning = pgTable("positioning", {
  id: serial().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  matrixId: integer("matrix_id")
    .notNull()
    .references(() => matrices.id, { onDelete: "cascade" })
    .unique(),
  globalStatus: positioningGlobalStatusEnum("global_status"),
  gapAnalysisSummary: jsonb("gap_analysis_summary").$type<
    GapAnalysisStructured | string
  >(),
  recommendedTheses: jsonb("recommended_theses")
    .$type<RecommendedThesisItem[]>()
    .default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Positioning = InferSelectModel<typeof positioning>;

export type NewPositioning = InferInsertModel<typeof positioning>;

export const boxTypeEnum = pgEnum("box_type_enum", [
  "SUBJECT_PROBLEM",
  "THEORETICAL_FRAMEWORK",
  "PRIMARY_MATERIAL",
  "METHODOLOGY",
  "RELATED_THESES",
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
    activeSeedIds: jsonb("active_seed_ids")
      .$type<number[]>()
      .default([])
      .notNull(),
    expansionCycle: integer("expansion_cycle").default(1).notNull(),
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

/** Outlines table — stores hierarchical chapter/section structure linked to a thesis matrix. */
export const outlines = pgTable(
  "outlines",
  {
    id: serial().primaryKey(),
    matrixId: integer()
      .notNull()
      .references(() => matrices.id, { onDelete: "cascade" }),
    parentId: integer(),
    title: text().notNull(),
    description: text(),
    sortOrder: integer().notNull(),
    academicField: text("academic_field"),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    index("idx_outlines_matrix_id").on(table.matrixId),
    index("idx_outlines_parent_id").on(table.parentId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("cascade"),
  ],
);

export type Outline = InferSelectModel<typeof outlines>;

export type NewOutline = InferInsertModel<typeof outlines>;

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
    boxId: integer("box_id")
      .notNull()
      .references(() => boxes.id, { onDelete: "cascade" }),
    title: text().notNull(),
    authors: text().array(),
    publisher: text(),
    containerTitle: text("container_title"),
    documentType: text("document_type"),
    publicationYear: integer(),
    doi: text(),
    openalexId: text("openalex_id"),
    isRead: boolean().default(false).notNull(),
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

/**
 * Expansions table — records each automatic literature expansion per sub-box
 * so the latest cycle can be undone (delete added sources and restore box seed state).
 */
export const expansions = pgTable(
  "expansions",
  {
    id: serial().primaryKey(),
    boxId: integer("box_id")
      .notNull()
      .references(() => boxes.id, { onDelete: "cascade" }),
    cycle: integer().notNull(),
    previousActiveSeedIds: jsonb("previous_active_seed_ids")
      .$type<number[]>()
      .notNull(),
    newActiveSeedIds: jsonb("new_active_seed_ids").$type<number[]>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_expansions_box_id").on(table.boxId)],
);

export type Expansion = InferSelectModel<typeof expansions>;

export type NewExpansion = InferInsertModel<typeof expansions>;

/** Annotations table — reading notebook storing page-numbered citations, personal notes, and meta-comments per library source. */
export const annotations = pgTable(
  "annotations",
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
    comment: text("comment"),
    sentToCitationCards: boolean("sent_to_citation_cards")
      .default(true)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_annotations_source_id").on(table.sourceId),
    index("idx_annotations_user_id").on(table.userId),
  ],
);

export type Annotation = InferSelectModel<typeof annotations>;

export type NewAnnotation = InferInsertModel<typeof annotations>;

/** Outline Annotations Junction — Links Citation Cards directly to specific Thesis Outline sections as writing evidence. */
export const outlineAnnotations = pgTable(
  "outline_annotations",
  {
    id: serial().primaryKey(),
    outlineId: integer("outline_id")
      .notNull()
      .references(() => outlines.id, { onDelete: "cascade" }),
    annotationId: integer("annotation_id")
      .notNull()
      .references(() => annotations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_outline_annotations_outline_id").on(table.outlineId),
    index("idx_outline_annotations_annotation_id").on(table.annotationId),
  ],
);

export type OutlineAnnotation = InferSelectModel<typeof outlineAnnotations>;
export type NewOutlineAnnotation = InferInsertModel<typeof outlineAnnotations>;

/** Outline Sources Junction — Links academic Library Sources directly to specific Thesis Outline sections as writing material. */
export const outlineSources = pgTable(
  "outline_sources",
  {
    id: serial().primaryKey(),
    outlineId: integer("outline_id")
      .notNull()
      .references(() => outlines.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_outline_sources_outline_id").on(table.outlineId),
    index("idx_outline_sources_source_id").on(table.sourceId),
  ],
);

export type OutlineSource = InferSelectModel<typeof outlineSources>;
export type NewOutlineSource = InferInsertModel<typeof outlineSources>;

/** Critiques table — 1:1 article analysis (research question, theoretical framework, methodology, main argument, literature gap) per library source. */
export const critiques = pgTable(
  "critiques",
  {
    id: serial().primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" })
      .unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    researchQuestion: text("research_question"),
    theoreticalFramework: text("theoretical_framework"),
    methodology: text("methodology"),
    mainArgument: text("main_argument"),
    literatureGap: text("literature_gap"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_critiques_source_id").on(table.sourceId)],
);

export type Critique = InferSelectModel<typeof critiques>;

export type NewCritique = InferInsertModel<typeof critiques>;

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
      sql`to_tsvector('turkish', "content") || to_tsvector('english', "content")`,
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
  matrix: one(matrices, {
    fields: [positioning.matrixId],
    references: [matrices.id],
  }),
}));

export const matricesRelations = relations(matrices, ({ one, many }) => ({
  user: one(users, {
    fields: [matrices.userId],
    references: [users.id],
  }),
  positioning: one(positioning),
  boxes: many(boxes),
  outlines: many(outlines),
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
  expansions: many(expansions),
}));

export const outlinesRelations = relations(outlines, ({ one, many }) => ({
  matrix: one(matrices, {
    fields: [outlines.matrixId],
    references: [matrices.id],
  }),
  parent: one(outlines, {
    fields: [outlines.parentId],
    references: [outlines.id],
    relationName: "outlineHierarchy",
  }),
  children: many(outlines, {
    relationName: "outlineHierarchy",
  }),
  outlineAnnotations: many(outlineAnnotations),
  outlineSources: many(outlineSources),
  sessions: many(sessions),
}));

export const annotationsRelations = relations(annotations, ({ one, many }) => ({
  source: one(sources, {
    fields: [annotations.sourceId],
    references: [sources.id],
  }),
  outlineAnnotations: many(outlineAnnotations),
}));

export const outlineAnnotationsRelations = relations(
  outlineAnnotations,
  ({ one }) => ({
    outline: one(outlines, {
      fields: [outlineAnnotations.outlineId],
      references: [outlines.id],
    }),
    annotation: one(annotations, {
      fields: [outlineAnnotations.annotationId],
      references: [annotations.id],
    }),
  }),
);

export const outlineSourcesRelations = relations(outlineSources, ({ one }) => ({
  outline: one(outlines, {
    fields: [outlineSources.outlineId],
    references: [outlines.id],
  }),
  source: one(sources, {
    fields: [outlineSources.sourceId],
    references: [sources.id],
  }),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  box: one(boxes, {
    fields: [sources.boxId],
    references: [boxes.id],
  }),
  critique: one(critiques, {
    fields: [sources.id],
    references: [critiques.sourceId],
  }),
  outlineSources: many(outlineSources),
}));

export const critiquesRelations = relations(critiques, ({ one }) => ({
  source: one(sources, {
    fields: [critiques.sourceId],
    references: [sources.id],
  }),
}));

export const expansionsRelations = relations(expansions, ({ one }) => ({
  box: one(boxes, {
    fields: [expansions.boxId],
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

/** Sessions table — stores advisor conversation threads and office review sessions per user. */
export const sessions = pgTable(
  "sessions",
  {
    id: serial().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    outlineId: integer("outline_id").references(() => outlines.id, {
      onDelete: "set null",
    }),
    title: varchar({ length: 255 }).notNull(),
    draftText: text("draft_text"),
    studentNote: text("student_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_outline_id").on(table.outlineId),
  ],
);

export type Session = InferSelectModel<typeof sessions>;

export type NewSession = InferInsertModel<typeof sessions>;

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  outline: one(outlines, {
    fields: [sessions.outlineId],
    references: [outlines.id],
  }),
  messages: many(messages),
}));

/** Messages table — stores individual messages within a chat session. */
export const messages = pgTable(
  "messages",
  {
    id: serial().primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: varchar({ length: 10 }).notNull(),
    persona: varchar("persona", { length: 30 }),
    content: text("content").notNull(),
    sources: jsonb("sources").$type<RagSearchResultItem[]>(),
    toolCalls: jsonb("tool_calls").$type<ChatToolCall[]>(),
    pipelineData: jsonb("pipeline_data").$type<PipelineResultData | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_messages_session_id").on(table.sessionId)],
);

export type Message = InferSelectModel<typeof messages>;

export type NewMessage = InferInsertModel<typeof messages>;

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
}));
