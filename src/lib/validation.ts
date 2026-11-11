/**
 * Client-side mirrors of the server's zod rules (server/source/dependency/pipe/validation.pipe.ts),
 * so users see field-level messages instead of the server's generic "validation failed".
 * Each validator returns an error message, or undefined when the value is valid.
 */
export type Validator = (value: string) => string | undefined;

export const validate = {
  email: (v: string) =>
    !v.trim()
      ? "Email is required"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
        ? "Enter a valid email"
        : undefined,

  username: (v: string) =>
    !/^[a-zA-Z0-9_]{3,30}$/.test(v.trim())
      ? "3–30 characters: letters, numbers and underscores"
      : undefined,

  fullName: (v: string) =>
    v.trim().length < 3 || v.trim().length > 30
      ? "Full name must be 3–30 characters"
      : !/^[\p{L}]+(?:[ '’-][\p{L}]+)*$/u.test(v.trim())
        ? "Use letters only"
        : undefined,

  password: (v: string) => {
    if (v.length < 8) return "At least 8 characters";
    if (v.length > 30) return "At most 30 characters";
    if (!/^[A-Za-z\d@$!%*?&]+$/.test(v)) return "Only letters, digits and @$!%*?& are allowed";
    if (!/[a-z]/.test(v) || !/[A-Z]/.test(v)) return "Use upper- and lower-case letters";
    if (!/\d/.test(v)) return "Include at least one number";
    if (!/[@$!%*?&]/.test(v)) return "Include one of @$!%*?&";
    return undefined;
  },

  loginPassword: (v: string) => (!v ? "Password is required" : undefined),

  confirm: (password: string) => (v: string) =>
    !v ? "Confirm your password" : v !== password ? "Passwords do not match" : undefined,

  phone: (v: string) =>
    !/^(?:\+201|01)[0125]\d{8}$/.test(v.trim())
      ? "Egyptian mobile number, e.g. 01012345678"
      : undefined,

  dob: (v: string) => {
    if (!v) return "Select your date of birth";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Select a valid date";
    const date = new Date(`${v}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Enter a real date";
    const now = new Date();
    const years = (now.getTime() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (years > 100) return "Must be within the last 100 years";
    if (years < 18) return "You must be at least 18";
    return undefined;
  },

  otp: (v: string) => (!/^\d{6}$/.test(v) ? "Enter the 6-digit code" : undefined),

  postContent: (v: string) =>
    !v.trim() ? "Write something first" : v.length > 5000 ? "At most 5000 characters" : undefined,

  commentContent: (v: string) =>
    !v.trim() ? "Write a comment first" : v.length > 2000 ? "At most 2000 characters" : undefined,
};

/** Runs every validator and returns only the failing fields. */
export function validateAll<K extends string>(
  rules: Record<K, [string, Validator]>
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const key of Object.keys(rules) as K[]) {
    const [value, rule] = rules[key];
    const message = rule(value);
    if (message) errors[key] = message;
  }
  return errors;
}
