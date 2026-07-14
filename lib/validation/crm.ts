import { z, type ZodError, type ZodType } from "zod";

/**
 * Zod request-body schemas for the native CRM. Parse with `parseBody`, which
 * returns a discriminated result the route can turn into a 400 without throwing.
 */

// Treat empty strings as "absent" for optional fields.
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().max(320).optional());
const optionalShortText = z.preprocess(emptyToUndefined, z.string().max(500).optional());
const optionalLongText = z.preprocess(emptyToUndefined, z.string().max(10_000).optional());

const lawfulBasis = z.enum(["legitimate_interest", "consent", "contract"]);
const contactSource = z.enum(["manual", "cvr", "import"]);

// ─── Contacts ───────────────────────────────────────────────────────────────

export const contactCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  title: optionalShortText,
  email: optionalEmail,
  phone: optionalShortText,
  linkedinUrl: optionalShortText,
  notes: optionalLongText,
  isPrimary: z.boolean().optional(),
  lawfulBasis: lawfulBasis.optional(),
  source: contactSource.optional(),
});
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

// All fields optional on update; must contain at least one.
export const contactUpdateSchema = contactCreateSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  { message: "No fields to update" }
);
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

// ─── Notes ────────────────────────────────────────────────────────────────

export const noteCreateSchema = z.object({
  content: z.string().trim().min(1, "Note cannot be empty").max(10_000),
});
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;

// ─── Pipelines & stages ─────────────────────────────────────────────────────

export const pipelineCreateSchema = z.object({
  name: z.string().trim().min(1, "Pipeline name is required").max(120),
});

export const pipelineUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

export const stageCreateSchema = z.object({
  name: z.string().trim().min(1, "Stage name is required").max(120),
  color: optionalShortText,
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const stageUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    color: optionalShortText,
    isWon: z.boolean().optional(),
    isLost: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

// Reorder: full ordered list of stage ids for a pipeline.
export const stageReorderSchema = z.object({
  orderedStageIds: z.array(z.string().uuid()).min(1),
});

// ─── Deals ──────────────────────────────────────────────────────────────────

const optionalAmount = z.preprocess(
  emptyToUndefined,
  z.coerce.number().min(0).max(1e15).nullish()
);
const optionalDate = z.preprocess(
  emptyToUndefined,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional()
);

export const dealCreateSchema = z.object({
  title: z.string().trim().min(1, "Deal title is required").max(200),
  companyId: z.string().uuid().optional(),
  cvr: optionalShortText,
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  amount: optionalAmount,
  currency: z.string().trim().length(3).optional(),
  closeDate: optionalDate,
  assignedUserId: z.preprocess(emptyToUndefined, z.string().optional()),
  primaryContactId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
}).refine((o) => o.companyId || o.cvr, {
  message: "Either companyId or cvr is required",
});
export type DealCreateInput = z.infer<typeof dealCreateSchema>;

export const dealUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    stageId: z.string().uuid().optional(),
    amount: optionalAmount,
    currency: z.string().trim().length(3).optional(),
    closeDate: optionalDate,
    assignedUserId: z.preprocess(emptyToUndefined, z.string().nullable().optional()),
    primaryContactId: z.preprocess(emptyToUndefined, z.string().uuid().nullable().optional()),
    lostReason: optionalShortText,
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;

// ─── Parse helper ─────────────────────────────────────────────────────────

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstIssueMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request body";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Validate an unknown body against a schema. Never throws. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: firstIssueMessage(result.error) };
}
