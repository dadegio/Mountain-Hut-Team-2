import { z } from "zod";

export const getUserQuerySchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  surname: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export type GetUserQuery = z.infer<typeof getUserQuerySchema>;

const baseUser = {
  id: z.number(),
  name: z.string(),
  phoneNumber: z.string().nullable(),
};

const standardUserSchema = z.object({
  ...baseUser,
  email: z.string(),
  surname: z.string(),
  type: z.enum(["HIKER", "EMPLOYEE", "MANAGER", "TEMPORARY"]),
  temporaryPassword: z.string().optional(),
});

const throwawayUserSchema = z.object({
  ...baseUser,
  email: z.string().nullable(),
  surname: z.string().nullable(),
  type: z.literal("THROWAWAY"),
});

export const userResponseSchema = z.discriminatedUnion("type", [
  standardUserSchema,
  throwawayUserSchema,
]);

export type UserResponse = z.infer<typeof userResponseSchema>;
