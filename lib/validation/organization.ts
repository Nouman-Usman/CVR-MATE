import { z } from "zod";

/**
 * Request schemas for the organization profile — the issuer identity printed on
 * quotes and orders.
 *
 * The rule the product settled on: an org may be created from the CVR registry
 * or by hand, but **either path must yield a name and an address**. A quote
 * without an issuer address is not a complete commercial document, and until
 * now every one this app sent was missing one.
 */

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** Same 8-digit shape the rest of the CRM uses. */
const optionalCvr = z.preprocess(
  emptyToUndefined,
  z.string().trim().regex(/^\d{8}$/, "Valid 8-digit CVR number is required").optional()
);

// Danish postcodes are exactly four digits. Kept permissive for other countries
// rather than rejecting them, since countryCode is not fixed to DK.
const zipCode = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(12).optional()
);

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(500)
    // Users type "fourmates.dk" far more often than "https://fourmates.dk", and
    // 7 of the 9 existing brand rows are stored in mixed forms. Normalising here
    // means the document renderer never has to guess.
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.url("Enter a valid website address"))
    .optional()
);

// Hex only. A colour goes straight into generated PDF markup, so anything that
// is not provably a colour has no business being there.
const brandColor = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex colour such as #1D4ED8")
    .optional()
);

const profileFields = {
  legalName: z.string().trim().min(1, "Company name is required").max(200),
  cvr: optionalCvr,
  addressLine: z.string().trim().min(1, "Address is required").max(300),
  zipCode,
  city: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  countryCode: z
    .string()
    .trim()
    .length(2, "Use a 2-letter country code")
    .toUpperCase()
    .default("DK"),
  email: z.preprocess(emptyToUndefined, z.email().max(320).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  website: optionalUrl,
  brandColor,
  /**
   * Provenance, asserted by the caller rather than inferred.
   *
   * `'cvr'` means these values came back from the registry and the user
   * confirmed them; `'manual'` means someone typed them. The route re-checks
   * that a `'cvr'` claim actually carries a CVR, so a client cannot mark
   * hand-typed data as registry-verified.
   */
  source: z.enum(["cvr", "manual"]).default("manual"),
};

export const organizationProfileInputSchema = z
  .object(profileFields)
  .refine((v) => v.source !== "cvr" || !!v.cvr, {
    message: "Registry-sourced details must include a CVR number",
    path: ["cvr"],
  });

export type OrganizationProfileInput = z.infer<typeof organizationProfileInputSchema>;

/**
 * Org creation. `name` is the display name; `legalName` inside the profile is
 * what appears on documents. They are usually the same and the UI defaults one
 * from the other, but "Nouman & Co" and "Fourmates ApS" are both legitimate and
 * only one of them belongs on a quote.
 */
export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(200),
  slug: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Slug may contain lowercase letters, numbers and dashes")
      .optional()
  ),
  profile: organizationProfileInputSchema,
});

/**
 * Editing an existing profile. Every field is optional so a caller may patch
 * one value, but the two that make a document valid cannot be blanked — a
 * profile that starts complete must stay complete.
 */
export const organizationProfileUpdateSchema = z.object({
  legalName: z.string().trim().min(1, "Company name cannot be empty").max(200).optional(),
  cvr: z.preprocess(emptyToNull, z.string().trim().regex(/^\d{8}$/).nullable().optional()),
  addressLine: z.string().trim().min(1, "Address cannot be empty").max(300).optional(),
  zipCode,
  city: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  email: z.preprocess(emptyToNull, z.email().max(320).nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()),
  website: z.preprocess(emptyToNull, optionalUrl.nullable()),
  brandColor: z.preprocess(emptyToNull, brandColor.nullable()),
});

export type OrganizationProfileUpdate = z.infer<typeof organizationProfileUpdateSchema>;
