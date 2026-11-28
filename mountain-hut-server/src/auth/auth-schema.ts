import { z } from "zod";
import { emailField, nameField, phoneField } from "../shared/fields.ts";

//
// REGISTRATION
//
export const registerSchema = z.object({
  email: emailField,
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: nameField("Name"),
  surname: nameField("Surname"),
  phoneNumber: phoneField,
});

export type RegisterInput = z.infer<typeof registerSchema>;

//
// LOGIN
//
export const loginSchema = z.object({
  email: emailField,
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
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;