import * as z from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal(""));

/**
 * Validates a marketplace dealer profile ("Become a dealer" and dealer settings).
 */
export const dealerProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Dealer name is required")
    .max(80, "Dealer name must be at most 80 characters"),
  slug: z
    .string()
    .trim()
    .min(3, "Profile URL must be at least 3 characters")
    .max(50, "Profile URL must be at most 50 characters")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and single dashes only",
    ),
  bio: optionalText(1000),
  phone: optionalText(30),
  whatsappPhone: optionalText(30),
  email: z
    .email({ error: "Valid email is required" })
    .optional()
    .or(z.literal("")),
  address: optionalText(200),
  city: optionalText(80),
});

/**
 * Parsed dealer profile data produced by `dealerProfileSchema`.
 */
export type DealerProfileFormData = z.infer<typeof dealerProfileSchema>;

/**
 * Builds a URL-safe slug suggestion from a dealer name.
 */
export function slugifyDealerName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}
