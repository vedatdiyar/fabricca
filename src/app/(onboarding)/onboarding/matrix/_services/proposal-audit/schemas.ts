import { z } from "zod";
import type { JsonSchema } from "@/core/services/ai";

/** Schema for multi-angle query decomposition */
export const queryDecompositionSchema = z.object({
  webQueries: z
    .array(z.string().min(3))
    .min(1)
    .max(2)
    .describe(
      "Güncel saha, mevzuat veya DergiPark aramaları için Exa sorguları",
    ),
  thesisQueries: z
    .array(z.string().min(3))
    .min(1)
    .max(2)
    .describe(
      "YÖK tez arşivindeki emsal çalışmalar ve metodolojik desenler için Qdrant sorguları",
    ),
  literatureQueries: z
    .array(z.string().min(3))
    .min(1)
    .max(2)
    .describe(
      "Uluslararası kuramsal tartışmalar ve öncü yazarlar için OpenAlex sorguları",
    ),
});

export type QueryDecomposition = z.infer<typeof queryDecompositionSchema>;

export const queryDecompositionJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    webQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Güncel saha, mevzuat veya DergiPark aramaları için Exa sorguları",
    },
    thesisQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖK tez arşivindeki emsal çalışmalar ve metodolojik desenler için Qdrant sorguları",
    },
    literatureQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Uluslararası kuramsal tartışmalar ve öncü yazarlar için OpenAlex sorguları",
    },
  },
  required: ["webQueries", "thesisQueries", "literatureQueries"],
};

/** Individual search chip visible in UI */
export interface SearchChip {
  id: string;
  query: string;
  channel: "web" | "thesis" | "literature";
  label: string;
  resultCount: number;
}

/** Clarification question for user */
export interface AuditQuestion {
  id: string;
  category:
    | "scope"
    | "focus"
    | "ambiguity"
    | "methodology"
    | "theoretical"
    | "empirical";
  categoryLabel: string;
  question: string;
  contextNote: string;
}

/** Full result of the proposal audit phase */
export interface ProposalAuditResult {
  searchChips: SearchChip[];
  evidenceSummary: string;
  strengths: string;
  diagnosticCritique: string;
  questions: AuditQuestion[];
}

export const auditOutputSchema = z.object({
  strengths: z
    .string()
    .min(10)
    .describe(
      "Tez önerisinin güçlü, özgün ve isabetli taraflarını belirten 1-2 cümle",
    ),
  diagnosticCritique: z
    .string()
    .min(10)
    .describe(
      "Önerinin kuramsal veya yöntemsel çerçevesine dair nesnel ve yapıcı tespit",
    ),
  questions: z
    .array(
      z.object({
        id: z.string(),
        category: z.enum(["scope", "focus", "ambiguity", "methodology"]),
        categoryLabel: z.string(),
        question: z.string().min(15),
        contextNote: z.string(),
      }),
    )
    .max(2)
    .describe(
      "Yalnızca kapsam veya odak tercihi gerekiyorsa en fazla 2 soru; metin yeterince netse kesinlikle boş dizi []",
    ),
});

export const auditOutputJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    strengths: { type: "string" },
    diagnosticCritique: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          category: {
            type: "string",
            enum: ["scope", "focus", "ambiguity", "methodology"],
          },
          categoryLabel: { type: "string" },
          question: { type: "string" },
          contextNote: { type: "string" },
        },
        required: [
          "id",
          "category",
          "categoryLabel",
          "question",
          "contextNote",
        ],
      },
    },
  },
  required: ["strengths", "diagnosticCritique", "questions"],
};
