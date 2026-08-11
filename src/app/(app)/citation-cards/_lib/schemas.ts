import { z } from "zod";

/** Note type validation schema. */
export const noteTypeSchema = z.enum([
  "DIRECT_QUOTE",
  "PARAPHRASE",
  "PERSONAL_NOTE",
]);

/** Schema for creating a new citation card. */
export const createCitationCardSchema = z.object({
  sourceId: z.number().int().positive("Geçerli bir kaynak seçilmelidir."),
  boxId: z.number().int().positive("Geçerli bir konu kutusu seçilmelidir."),
  noteType: noteTypeSchema,
  pageNumber: z.string().min(1, "Sayfa numarası gereklidir."),
  content: z.string().min(1, "Fiş içeriği boş olamaz."),
  comment: z
    .string()
    .trim()
    .max(4000, "Yorum en fazla 4000 karakter olabilir.")
    .optional(),
});

/** Schema for updating an existing citation card. */
export const updateCitationCardSchema = createCitationCardSchema.extend({
  id: z.number().int().positive("Geçerli bir fiş ID'si gereklidir."),
});

/** Input payload type for creating a citation card. */
export type CreateCitationCardInput = z.infer<
  typeof createCitationCardSchema
>;

/** Input payload type for updating a citation card. */
export type UpdateCitationCardInput = z.infer<
  typeof updateCitationCardSchema
>;