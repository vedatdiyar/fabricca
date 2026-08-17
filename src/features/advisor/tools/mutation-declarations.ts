import type { FunctionDeclaration } from "@google/genai";

/** List of all Gemini Function Declarations for mutating user thesis, library, and task data. */
export const MUTATION_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "updateThesisMatrix",
    description:
      "Updates one or more fields of the user's core thesis matrix (subject/problem, theoretical framework, primary material, methodology).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        subjectProblem: {
          type: "string",
          description: "Updated subject and problem statement of the thesis.",
        },
        theoreticalFramework: {
          type: "string",
          description: "Updated theoretical framework.",
        },
        primaryMaterial: {
          type: "string",
          description: "Updated primary material or empirical dataset.",
        },
        methodology: {
          type: "string",
          description: "Updated research methodology.",
        },
      },
    },
  },
  {
    name: "createBox",
    description:
      "Creates a new research box linked to the user's thesis matrix.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        boxType: {
          type: "string",
          enum: [
            "SUBJECT_PROBLEM",
            "THEORETICAL_FRAMEWORK",
            "PRIMARY_MATERIAL",
            "METHODOLOGY",
            "RELATED_THESES",
          ],
          description: "Category of the box.",
        },
        title: {
          type: "string",
          description: "Title of the box.",
        },
        description: {
          type: "string",
          description: "Detailed description of the box purpose or concept.",
        },
      },
      required: ["boxType", "title"],
    },
  },
  {
    name: "updateBox",
    description: "Updates an existing research box title or description.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        boxId: {
          type: "integer",
          description: "The ID of the box to update.",
        },
        title: {
          type: "string",
          description: "New title for the box.",
        },
        description: {
          type: "string",
          description: "New description for the box.",
        },
      },
      required: ["boxId"],
    },
  },
  {
    name: "deleteBox",
    description: "Deletes a research box from the user's thesis structure.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        boxId: {
          type: "integer",
          description: "The ID of the box to delete.",
        },
      },
      required: ["boxId"],
    },
  },
  {
    name: "updateSource",
    description:
      "Updates metadata or reading status of an academic source in the user's library.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "integer",
          description: "The ID of the source to update.",
        },
        title: {
          type: "string",
          description: "Updated title of the source.",
        },
        isRead: {
          type: "boolean",
          description: "Whether the user has read this source.",
        },
        comparisonNote: {
          type: "string",
          description: "Comparative notes regarding this source.",
        },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "deleteSource",
    description:
      "Deletes an academic literature source from the user's library.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "integer",
          description: "The ID of the source to remove.",
        },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "addNote",
    description:
      "Adds a new citation, paraphrase, or personal note linked to an academic source.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "integer",
          description: "The ID of the source being cited or noted.",
        },
        pageNumber: {
          type: "string",
          description: "Page number or page range (e.g. '45' or '12-14').",
        },
        noteType: {
          type: "string",
          enum: ["DIRECT_QUOTE", "PARAPHRASE", "PERSONAL_NOTE"],
          description: "Type of academic note.",
        },
        content: {
          type: "string",
          description: "The quote text or note content.",
        },
        comment: {
          type: "string",
          description: "Optional user commentary or reflective note.",
        },
      },
      required: ["sourceId", "pageNumber", "noteType", "content"],
    },
  },
  {
    name: "deleteNote",
    description: "Deletes a saved note or citation from the user's library.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "integer",
          description: "The ID of the note to delete.",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "createTask",
    description:
      "Creates a new research or thesis writing task in the user's Kanban board.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the research task.",
        },
        description: {
          type: "string",
          description: "Detailed instructions or description of the task.",
        },
        priority: {
          type: "string",
          enum: ["HIGH", "MEDIUM", "LOW"],
          description: "Priority level of the task.",
        },
        boxId: {
          type: "integer",
          description: "Optional box ID to associate the task with.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "updateTaskStatus",
    description:
      "Updates the Kanban status of a research task (TODO, IN_PROGRESS, DONE).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "integer",
          description: "The ID of the task.",
        },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
          description: "New status.",
        },
      },
      required: ["taskId", "status"],
    },
  },
  {
    name: "createOutlineSection",
    description:
      "Creates a new chapter or sub-section in the user's thesis outline/table of contents.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the new chapter or section.",
        },
        description: {
          type: "string",
          description:
            "Writing scope or summary of what will be discussed in this section.",
        },
        parentId: {
          type: "integer",
          description: "Optional parent outline ID to create a sub-section.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "updateOutlineSection",
    description:
      "Updates the title or writing scope description of an existing thesis outline section.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        outlineId: {
          type: "integer",
          description: "The ID of the outline section to update.",
        },
        title: {
          type: "string",
          description: "New title for the section.",
        },
        description: {
          type: "string",
          description: "New writing scope description.",
        },
      },
      required: ["outlineId"],
    },
  },
  {
    name: "pinAnnotationToOutline",
    description:
      "Pins a specific reading citation card (annotation ID) to a thesis outline section as writing evidence.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        outlineId: {
          type: "integer",
          description: "The ID of the outline section.",
        },
        annotationId: {
          type: "integer",
          description: "The ID of the citation card (annotation).",
        },
      },
      required: ["outlineId", "annotationId"],
    },
  },
  {
    name: "unpinAnnotationFromOutline",
    description:
      "Removes a pinned citation card (annotation ID) from a thesis outline section.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        outlineId: {
          type: "integer",
          description: "The ID of the outline section.",
        },
        annotationId: {
          type: "integer",
          description: "The ID of the citation card (annotation) to unpin.",
        },
      },
      required: ["outlineId", "annotationId"],
    },
  },
  {
    name: "linkSourceToOutline",
    description:
      "Links a specific academic library source to a thesis outline section as the source material used when writing it.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        outlineId: {
          type: "integer",
          description: "The ID of the outline section.",
        },
        sourceId: {
          type: "integer",
          description: "The ID of the library source to link.",
        },
      },
      required: ["outlineId", "sourceId"],
    },
  },
  {
    name: "unlinkSourceFromOutline",
    description:
      "Removes a linked academic library source from a thesis outline section.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        outlineId: {
          type: "integer",
          description: "The ID of the outline section.",
        },
        sourceId: {
          type: "integer",
          description: "The ID of the library source to unlink.",
        },
      },
      required: ["outlineId", "sourceId"],
    },
  },
];
