import z from "zod";

export const allergenSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export type Allergen = z.infer<typeof allergenSchema>;
