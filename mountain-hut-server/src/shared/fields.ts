import { z } from "zod";

// Digits with an optional leading +, spaces, dashes or brackets; 6–20 characters
export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,19}$/;

/** Emails are case-insensitive: spaces are removed and they are stored in lowercase */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Invalid email format"));

/** A name or surname: spaces around it are removed first, so "   " is rejected */
export const nameField = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(100, `${label} is too long`);

/** Stored without spaces, dashes or brackets, so the same number always matches */
/** A phone number in a valid format, kept as typed (e.g. emergency contacts) */
export const phoneFormat = z.string().trim().regex(PHONE_PATTERN, "Invalid phone number");

/** Account phone numbers: stored without spaces, dashes or brackets, so duplicates and searches always match */
export const phoneField = phoneFormat.transform((value) => value.replace(/[\s()-]/g, ""));