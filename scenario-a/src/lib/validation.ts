import { z } from "zod";
import { RAG_STATUSES } from "@/db/schema";
import { currentMonth } from "./format";

/**
 * Parses a user-typed naira amount ("12,500,000.50") into integer kobo using
 * string arithmetic, so no value ever passes through a float.
 */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[,\s₦]/g, "");
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const monthlyUpdateSchema = z.object({
  portfolioId: z.string().min(1, "Select a portfolio."),
  reportingMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Select a reporting month.")
    .refine((m) => m <= currentMonth(), "Reporting month cannot be in the future."),
  cashPosition: z
    .string()
    .trim()
    .min(1, "Enter the cash position.")
    .transform((value, ctx) => {
      const kobo = parseNairaToKobo(value);
      if (kobo === null) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a positive naira amount with at most two decimal places.",
        });
        return z.NEVER;
      }
      return kobo;
    }),
  ragStatus: z.enum(RAG_STATUSES, { message: "Select a RAG status." }),
  executionBlocker: z
    .string()
    .trim()
    .min(3, "Describe the main execution blocker, or write “None”.")
    .max(600, "Keep the blocker under 600 characters."),
});

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export function firstErrors<T extends string>(error: z.ZodError): FieldErrors<T> {
  const out: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as T;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
