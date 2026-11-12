/**
 * Zod schemas mirroring the server's rules (server/source/dependency/pipe/validation.pipe.ts and
 * the feature DTOs), so users see field-level messages instead of the server's generic
 * "validation failed". The regexes and limits are the server's; the messages are friendlier and
 * more specific (e.g. which password rule failed). Keep both sides in sync.
 *
 * Schemas also normalize input (trim, lower-case email), so screens submit `result.data`.
 */
import { z } from "zod";

// ── fields ───────────────────────────────────────────────────────────────────────────────────────

const PASSWORD_CHARS = /^[A-Za-z\d@$!%*?&]+$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

const yearsSince = (date: Date) => (Date.now() - date.getTime()) / YEAR_MS;

export const fields = {
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .pipe(z.email("Enter a valid email"))
    .transform((email) => email.toLowerCase()),

  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,30}$/, "3–30 characters: letters, numbers and underscores"),

  fullName: z
    .string()
    .trim()
    .min(3, "Full name must be 3–30 characters")
    .max(30, "Full name must be 3–30 characters")
    .regex(/^[\p{L}]+(?:[ '’-][\p{L}]+)*$/u, "Use letters only"),

  /** Rules checked in order; the first failing one is shown. */
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(30, "At most 30 characters")
    .regex(PASSWORD_CHARS, "Only letters, digits and @$!%*?& are allowed")
    .regex(/(?=.*[a-z])(?=.*[A-Z])/, "Use upper- and lower-case letters")
    .regex(/\d/, "Include at least one number")
    .regex(/[@$!%*?&]/, "Include one of @$!%*?&"),

  /** Login only checks presence, so old accounts and typos get the server's answer. */
  loginPassword: z.string().min(1, "Password is required"),

  phone: z
    .string()
    .trim()
    .regex(/^(?:\+201|01)[0125]\d{8}$/, "Egyptian mobile number, e.g. 01012345678"),

  /** `YYYY-MM-DD`, 18–100 years ago. */
  dob: z
    .string()
    .min(1, "Select your date of birth")
    .regex(DATE_ONLY, "Select a valid date")
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), "Enter a real date")
    .refine(
      (value) => yearsSince(new Date(`${value}T00:00:00`)) <= 100,
      "Must be within the last 100 years"
    )
    .refine((value) => yearsSince(new Date(`${value}T00:00:00`)) >= 18, "You must be at least 18"),

  gender: z.enum(["MALE", "FEMALE"], "Choose one"),

  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),

  postContent: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(5000, "At most 5000 characters"),

  commentContent: z
    .string()
    .trim()
    .min(1, "Write a comment first")
    .max(2000, "At most 2000 characters"),

  groupName: z.string().trim().min(1, "Give your group a name").max(50, "At most 50 characters"),

  /** First or last name on `PATCH /users/me` (server: 2–30 letters, single separators). */
  namePart: z
    .string()
    .trim()
    .min(2, "2–30 characters")
    .max(30, "2–30 characters")
    .regex(/^[\p{L}]+(?:[ '’-][\p{L}]+)*$/u, "Use letters only"),

  bio: z.string().trim().max(500, "At most 500 characters"),
};

// ── forms ────────────────────────────────────────────────────────────────────────────────────────

/** Adds the "passwords match" check to a schema with `password` + `confirmPassword`. */
const withMatchingPasswords = <
  S extends z.ZodObject<{ password: z.ZodType<string>; confirmPassword: z.ZodType<string> }>,
>(
  schema: S
) =>
  schema.refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
    // Object refinements are skipped when any field failed; run this one regardless so the
    // mismatch shows alongside the other errors (the field's own "Confirm…" message wins if empty).
    when: ({ value }) => typeof value === "object" && value !== null,
  });

const confirmPassword = z.string().min(1, "Confirm your password");

export const schemas = {
  login: z.object({ email: fields.email, password: fields.loginPassword }),

  signup: withMatchingPasswords(
    z.object({
      fullName: fields.fullName,
      username: fields.username,
      email: fields.email,
      phoneNumber: fields.phone,
      DOB: fields.dob,
      gender: fields.gender,
      password: fields.password,
      confirmPassword,
    })
  ),

  verifyEmail: z.object({ email: fields.email, otp: fields.otp }),

  forgotPasswordEmail: z.object({ email: fields.email }),

  forgotPasswordCode: z.object({ otp: fields.otp }),

  resetPassword: withMatchingPasswords(z.object({ password: fields.password, confirmPassword })),

  post: z.object({ content: fields.postContent }),

  comment: z.object({ content: fields.commentContent }),

  /** Edit profile. Phone may be left empty (the server can't clear it, so it's just not sent). */
  editProfile: z.object({
    firstName: fields.namePart,
    lastName: fields.namePart,
    username: fields.username,
    bio: fields.bio,
    phone: z.union([z.literal(""), fields.phone]),
    DOB: z.union([z.literal(""), fields.dob]),
    gender: z.union([z.literal(""), fields.gender]),
  }),

  changePassword: withMatchingPasswords(
    z.object({ otp: fields.otp, password: fields.password, confirmPassword })
  ),
};

// ── running a schema ─────────────────────────────────────────────────────────────────────────────

/** Field → first error message, for `FieldError` / `FormField error=`. */
export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export type FormResult<S extends z.ZodType> =
  { success: true; data: z.output<S> } | { success: false; errors: FieldErrors<z.input<S>> };

/**
 * Validates form values. On failure returns the first message per field (zod reports every
 * issue; screens show one at a time, in the order the rules are declared).
 */
export function validateForm<S extends z.ZodType>(schema: S, values: unknown): FormResult<S> {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) errors[key] = issue.message;
  }
  return { success: false, errors: errors as FieldErrors<z.input<S>> };
}

/** First error message for a single value, or undefined when valid. */
export function fieldError(schema: z.ZodType, value: unknown): string | undefined {
  const result = schema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}
