import { z } from "zod";
import { normalizeUrl } from "./analyzer/normalize-url";

export const websiteUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required.")
  .max(2048, "URL is too long.")
  .transform((value, context) => {
    const normalized = normalizeUrl(value);
    if (!normalized.accepted || !normalized.value) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: normalized.message ?? "Enter a valid public HTTP or HTTPS URL." });
      return z.NEVER;
    }
    return normalized.value;
  });
