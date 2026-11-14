import { z } from "zod";
import { USER_TYPES } from "../db/schema.ts";

export const getUserQuerySchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  surname: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export const userResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  surname: z.string().default(""),
  phoneNumber: z.string().nullable().optional(),
  type: z.enum(USER_TYPES),
});

export type GetUserQuery = z.infer<typeof getUserQuerySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
