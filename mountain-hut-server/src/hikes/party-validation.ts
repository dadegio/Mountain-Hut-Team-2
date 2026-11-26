import { z } from "zod";

export const partyMemberSchema = z.object({
  name: z.string().trim().min(1).max(200),
  surname: z.string().trim().min(1).max(200).optional(),
  phoneNumber: z.string().trim().min(3).max(40).optional(),
}).strict();

export const hikePartySchema = z.object({
  partySize: z.number().int().min(1).max(1000),
  members: z.array(partyMemberSchema).max(999),
}).strict().refine(({ partySize, members }) => members.length === partySize - 1, {
  path: ["members"],
  message: "Provide details for every additional party member (partySize - 1)",
});

export const hikeIdParamsSchema = z.object({
  id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export type HikePartyInput = z.infer<typeof hikePartySchema>;
