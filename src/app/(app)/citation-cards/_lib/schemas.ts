import { z } from "zod";

/** Note type validation schema. */
export const noteTypeSchema = z.enum([
  "DIRECT_QUOTE",
  "PARAPHRASE",
  "PERSONAL_NOTE",
]);

/** Schema for creating a new citation card. */
export const createCitationCardSchema = z.object({
  sourceId: z.number().int().positive("A valid source must be selected."),
  boxId: z.number().int().positive("A valid thesis box must be selected."),
  noteType: noteTypeSchema,
  pageNumber: z.string().min(1, "Page number is required."),
  content: z.string().min(1, "Card content cannot be empty."),
  comment: z
    .string()
    .trim()
    .max(4000, "Comment can be at most 4000 characters.")
    .optional(),
});

/** Schema for updating an existing citation card. */
export const updateCitationCardSchema = createCitationCardSchema.extend({
  id: z.number().int().positive("A valid card ID is required."),
});

/** Input payload type for creating a citation card. */
export type CreateCitationCardInput = z.infer<typeof createCitationCardSchema>;

/** Input payload type for updating a citation card. */
export type UpdateCitationCardInput = z.infer<typeof updateCitationCardSchema>;
