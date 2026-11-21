import { z } from "zod";

//
// REGISTRATION
//
const standardRegisterSchema = z.object({
  type: z.enum(["HIKER", "EMPLOYEE", "MANAGER"]).default("HIKER"),
  email: z.email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

const temporaryRegisterSchema = z.object({
  type: z.literal("TEMPORARY"),
  email: z.email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .nullish()
    .default(null),
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

const throwawayRegisterSchema = z.object({
  type: z.literal("THROWAWAY"),
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email format").nullish().default(null),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .nullish()
    .default(null),
  surname: z.string().min(1).nullish().default(null),
  phoneNumber: z.string().min(1).nullish().default(null),
});

export const registerSchema = z.discriminatedUnion("type", [
  standardRegisterSchema,
  temporaryRegisterSchema,
  throwawayRegisterSchema,
]);

export type RegisterInput = z.infer<typeof registerSchema>;

//
// LOGIN
//
export const loginSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

//
// CHANGE PASSWORD
//
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
