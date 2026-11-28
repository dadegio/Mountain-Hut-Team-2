import { z } from "zod";
import { emailField, nameField, phoneField } from "../shared/fields.ts";

//
// QUERY
//
// Searches use the same normalization as stored values, so they always match
export const getUserQuerySchema = z.object({
  email: z.string().trim().toLowerCase().optional(),
  name: z.string().trim().optional(),
  surname: z.string().trim().optional(),
  phoneNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .optional(),
});

export type GetUserQuery = z.infer<typeof getUserQuerySchema>;

//
// CREATION
//
const contactFields = z.object({
  email: emailField,
  name: nameField("Name"),
  surname: nameField("Surname"),
  phoneNumber: phoneField,
});

export const standardUserCreationSchema = contactFields.extend({
  password: z.string().min(8, "Password must be at least 8 characters long"),
  type: z.enum(["HIKER", "EMPLOYEE", "MANAGER"]),
});

export const temporaryUserCreationSchema = contactFields.extend({
  type: z.literal("TEMPORARY"),
});

export const throwawayUserCreationSchema = z.object({
  name: nameField("Name"),
  phoneNumber: phoneField.nullable().optional(),
  type: z.literal("THROWAWAY"),
});

export const userCreationSchema = z.discriminatedUnion("type", [
  standardUserCreationSchema,
  temporaryUserCreationSchema,
  throwawayUserCreationSchema,
]);

export type UserCreation = z.infer<typeof userCreationSchema>;

//
// RESPONSE
//
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
