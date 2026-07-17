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
import {
  relations,
  type InferSelectModel,
  type InferInsertModel,
} from "drizzle-orm";

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

/**
 * Thesis Matrix table.
 * Stores the working title, research question, main claim, methodology,
 * theoretical framework, and temporal/spatial scope filled by the user
 * during the first step of onboarding.
 */
export const thesisMatrices = pgTable("thesis_matrices", {
  id: serial().primaryKey(),
  userId: integer()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  mainActors: text().notNull(),
  researchFocus: text().notNull(),
  context: text().notNull(),
  theoreticalFramework: text().notNull(),
  methodology: text().notNull(),
  mainClaim: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

/** User type for select queries. */
export type User = InferSelectModel<typeof users>;

/** User type for insert queries. */
export type NewUser = InferInsertModel<typeof users>;

/** ThesisMatrix type for select queries. */
export type ThesisMatrix = InferSelectModel<typeof thesisMatrices>;

/** ThesisMatrix type for insert queries. */
export type NewThesisMatrix = InferInsertModel<typeof thesisMatrices>;

/**
 * Originality Report table (Zero-JSONB multi-row).
 * Each compared thesis is stored as an independent row.
 * Uses a decision-tree-based badge system.
 * Converted to the nested TezaraResult contract via groupRowsToReport()
 * keyed by userId — all UI components consume this shape.
 */
export const originalityReports = pgTable(
  "originality_reports",
  {
    id: serial().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    externalThesisId: integer().notNull(),
    title: text().notNull(),
    author: text().notNull(),
    university: text().notNull(),
    year: integer().notNull(),
    thesisType: text().notNull(),
    department: text().notNull(),
    yokPdfUrl: text(),
    abstract: text(),
    /**
     * Primary badge produced by the 4-step academic decision engine.
     * Possible values: IRRELEVANT_DATA, TWIN_THESIS_ALERT,
     * CRITICAL_REPLICATION_ALERT, plus 27 matrix-based academic badges
     * (INDEPENDENT_CONCEPTUAL_STUDY … TEMPORAL_UPDATE_STUDY)
     */
    diagnosis: varchar({ length: 100 }).notNull(),
    /** Composite relevance score (sum of all 6 LLM dimensions, range 0-600) */
    relevanceScore: integer("relevance_score").notNull().default(0),
    /** Individual LLM dimension scores */
    researchFocusScore: integer("research_focus_score"),
    mainActorsScore: integer("main_actors_score"),
    scopeContextScore: integer("scope_context_score"),
    temporalLabel: varchar("temporal_label", { length: 20 }),
    theoreticalFrameworkScore: integer("theoretical_framework_score"),
    methodologyScore: integer("methodology_score"),
    mainClaimScore: integer("main_claim_score"),
    /** Academic tactic (action plan) */
    academicTactic: text("academic_tactic").notNull(),
    /** Flag for eliminated theses — when true, hidden from the main overlap table */
    isEliminated: boolean().default(false).notNull(),
    /** Elimination stage: SIFTING (before Cohere rerank) or ANALYSIS (after jury) */
    eliminationStage: varchar("elimination_stage", { length: 20 }),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    index("idx_or_user_id").on(table.userId),
    index("idx_or_diagnosis").on(table.diagnosis),
    index("idx_or_external_id").on(table.externalThesisId),
    index("idx_or_user_eliminated").on(table.userId, table.isEliminated),
  ],
);

/** OriginalityReport type for select queries. */
export type OriginalityReport = InferSelectModel<typeof originalityReports>;

/** OriginalityReport type for insert queries. */
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
    comparisonNote: text(),
    badge: varchar({ length: 50 }),
    url: text(),
    doi: text(),
    publisher: text(),
    publicationYear: integer(),
    authors: text().array(),
    isRead: boolean().default(false).notNull(),

    relevanceScore: real(),
    isFoundational: boolean().default(false).notNull(),
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

export const usersRelations = relations(users, ({ one, many }) => ({
  thesisMatrix: one(thesisMatrices),
  originalityReports: many(originalityReports),
  tasks: many(tasks),
}));

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

export const originalityReportsRelations = relations(
  originalityReports,
  ({ one }) => ({
    user: one(users, {
      fields: [originalityReports.userId],
      references: [users.id],
    }),
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
