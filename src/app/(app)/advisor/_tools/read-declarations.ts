import type { FunctionDeclaration } from "@google/genai";

/** List of all Gemini Function Declarations for reading user thesis and research data. */
export const READ_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "getThesisMatrix",
    description:
      "Fetches the user's current thesis matrix (subject/problem, theoretical framework, primary material, methodology).",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "listBoxes",
    description:
      "Lists all thesis boxes created by the user, categorized by box type (e.g. SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, PRIMARY_MATERIAL, METHODOLOGY, RELATED_THESES).",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "searchSources",
    description:
      "Searches academic literature sources saved in the user's library by search query or box ID.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Optional text search query to filter sources by title or author.",
        },
        boxId: {
          type: "integer",
          description:
            "Optional box ID to retrieve sources linked to a specific box.",
        },
      },
    },
  },
  {
    name: "listNotes",
    description:
      "Retrieves saved academic notes and citations for a specific source or lists recent notes.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "integer",
          description:
            "Optional source ID to filter notes for a single academic source.",
        },
      },
    },
  },
  {
    name: "listTasks",
    description:
      "Lists research tasks/kanban items for the user, optionally filtered by status.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
          description: "Optional status filter.",
        },
      },
    },
  },
];
