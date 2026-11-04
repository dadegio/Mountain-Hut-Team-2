import { z } from "zod";
import { USER_TYPES } from "../db/schema.ts";

export const registerSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  phone_number: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const userResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  surname: z.string(),
  phone_number: z.string().nullable().optional(),
  type: z.enum(USER_TYPES),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
