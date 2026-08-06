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

// One CVR shape for every optional cvr field — deals and quotes used to accept
// any 500-char string here while prospects required 8 digits.
const optionalCvr = z.preprocess(
  emptyToUndefined,
  z.string().trim().regex(/^\d{8}$/, "Valid 8-digit CVR number is required").optional()
);

/** YYYY-MM-DD strings order chronologically under plain string comparison. */
const notBefore = (start?: string | null, end?: string | null) =>
  !start || !end || end >= start;

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

// ─── Prospects (enter CVR → workspace + optional save + initial contacts) ────

const workspaceStatus = z.enum([
  "prospect",
  "lead",
  "qualified",
  "customer",
  "churned",
]);

const optionalTags = z.array(z.string().trim().min(1).max(40)).max(20).optional();

// Contacts embedded in the prospect payload default their provenance to "cvr".
export const prospectCreateSchema = z.object({
  vat: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Valid 8-digit CVR number is required"),
  status: workspaceStatus.optional(),
  tags: optionalTags,
  save: z.boolean().optional(),
  note: optionalLongText,
  contacts: z.array(contactCreateSchema).max(20).optional(),
});
export type ProspectCreateInput = z.infer<typeof prospectCreateSchema>;

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

// The deal dialogs post `amount` as the raw input string, so convert numeric
// strings here — but only those. `z.coerce.number()` also turned null, true,
// "" and [] into 0 and waved them through as valid amounts.
const numericStringToNumber = (v: unknown) =>
  typeof v === "string" && v.trim() !== "" ? Number(v) : emptyToUndefined(v);

// The app is DKK-only and honest about it: formatOre/formatDKK hardcode the
// currency, so accepting "EUR" here would store a value that renders as kroner
// everywhere. Real multi-currency is an epic (FX rates, per-currency rounding
// and VAT rules), not a column — until then this rejects rather than pretends.
const currencySchema = z.literal("DKK").optional();

// Deal value in INTEGER ØRE — the single CRM money unit. Clients must convert
// typed kroner with parseKronerToOre before sending.
const optionalAmount = z.preprocess(
  numericStringToNumber,
  z.number().int().min(0).max(1e17).nullish()
);
const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    // The shape check alone admits impossible dates ("2026-13-99", "2026-02-30")
    // that reach Postgres as an error or become an Invalid Date downstream.
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, "Not a valid calendar date")
    .optional()
);

export const dealCreateSchema = z.object({
  title: z.string().trim().min(1, "Deal title is required").max(200),
  companyId: z.string().uuid().optional(),
  cvr: optionalCvr,
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  amount: optionalAmount,
  currency: currencySchema,
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
    currency: currencySchema,
    closeDate: optionalDate,
    assignedUserId: z.preprocess(emptyToUndefined, z.string().nullable().optional()),
    primaryContactId: z.preprocess(emptyToUndefined, z.string().uuid().nullable().optional()),
    lostReason: optionalShortText,
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;

// ─── Interactions (typed CRM touchpoints + follow-ups) ───────────────────────

const interactionType = z.enum(["meeting", "visit", "call", "email", "note"]);
const interactionDirection = z.enum(["inbound", "outbound", "internal"]);

export const interactionCreateSchema = z.object({
  type: interactionType,
  direction: interactionDirection.optional(),
  occurredAt: optionalDate, // YYYY-MM-DD; defaults to now() when absent
  subject: optionalShortText,
  body: optionalLongText,
  topics: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  nextStep: optionalShortText,
  nextStepAt: optionalDate,
  contactId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  dealId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});
export type InteractionCreateInput = z.infer<typeof interactionCreateSchema>;

export const interactionUpdateSchema = interactionCreateSchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
export type InteractionUpdateInput = z.infer<typeof interactionUpdateSchema>;

// ─── Contracts ───────────────────────────────────────────────────────────────

const contractStatus = z.enum(["draft", "active", "expired", "cancelled", "renewed"]);
// Contract value in INTEGER ØRE — same unit as deals, quotes and orders.
const optionalWholeAmount = z.preprocess(
  numericStringToNumber,
  z.number().int().min(0).max(1e17).nullish()
);

const expiryAfterStart = {
  message: "Expiry date cannot be before the start date",
  path: ["expiryDate"],
};

// Kept unrefined: Zod rejects `.partial()` on an object that carries checks, and
// contractUpdateSchema derives from this shape.
const contractFields = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  status: contractStatus.optional(),
  startDate: optionalDate,
  expiryDate: optionalDate,
  value: optionalWholeAmount,
  currency: currencySchema,
  renewalNoticeDays: z.preprocess(
    emptyToUndefined,
    z.number().int().min(0).max(365).optional()
  ),
  autoRenew: z.boolean().optional(),
  externalRef: optionalShortText,
  notes: optionalLongText,
  dealId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const contractCreateSchema = contractFields.refine(
  (o) => notBefore(o.startDate, o.expiryDate),
  expiryAfterStart
);
export type ContractCreateInput = z.infer<typeof contractCreateSchema>;

export const contractUpdateSchema = contractFields
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" })
  .refine((o) => notBefore(o.startDate, o.expiryDate), expiryAfterStart);
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;

// ─── Segments ────────────────────────────────────────────────────────────────

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #RRGGBB hex color");

export const segmentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  color: z.preprocess(emptyToUndefined, hexColor.optional()),
  description: optionalShortText,
});
export type SegmentCreateInput = z.infer<typeof segmentCreateSchema>;

export const segmentUpdateSchema = segmentCreateSchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
export type SegmentUpdateInput = z.infer<typeof segmentUpdateSchema>;

export const companySegmentAssignSchema = z.object({
  segmentId: z.string().uuid(),
});
export type CompanySegmentAssignInput = z.infer<typeof companySegmentAssignSchema>;

// ─── Products ────────────────────────────────────────────────────────────────

// Money in ØRE (integer minor units); vat/discount as percent.
const oreAmount = z.number().int().min(0).max(1e15);
const percent = z.number().min(0).max(100);

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  sku: optionalShortText,
  description: optionalLongText,
  unitPrice: oreAmount,
  vatRate: percent.optional(),
  unit: optionalShortText,
  active: z.boolean().optional(),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sku: optionalShortText,
    description: optionalLongText,
    unitPrice: oreAmount.optional(),
    vatRate: percent.optional(),
    unit: optionalShortText,
    active: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// ─── Quotes + Orders ─────────────────────────────────────────────────────────

/**
 * Per-line value ceiling, in øre (1e13 øre = 100bn DKK). `quantity` and
 * `unitPrice` are each individually plausible at their own maximums, but their
 * *product* reaches 1e24 — far past Number.MAX_SAFE_INTEGER (9.007e15), where
 * the arithmetic silently loses precision before Postgres bigint would reject
 * it. Bound the product, not just the factors.
 */
const MAX_LINE_ORE = 1e13;

const documentLineInput = z
  .object({
    productId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    description: z.string().trim().min(1, "Line description is required").max(500),
    // A zero-quantity line is never intentional; it is what a failed client-side
    // parse used to produce.
    quantity: z.number().gt(0).max(1e9),
    unitPrice: oreAmount, // øre
    discountPct: percent.optional(),
    vatRate: percent.optional(),
  })
  .refine((l) => l.quantity * l.unitPrice <= MAX_LINE_ORE, {
    message: "Line value is too large",
    path: ["unitPrice"],
  });
export type DocumentLineInput = z.infer<typeof documentLineInput>;

const validUntilAfterIssue = {
  message: "Valid-until date cannot be before the issue date",
  path: ["validUntil"],
};

export const quoteCreateSchema = z
  .object({
    companyId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    cvr: optionalCvr,
    dealId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    issueDate: optionalDate,
    validUntil: optionalDate,
    terms: optionalLongText,
    notes: optionalLongText,
    lines: z.array(documentLineInput).min(1, "At least one line is required").max(200),
  })
  .refine((o) => o.companyId || o.cvr, {
    message: "Either companyId or cvr is required",
  })
  .refine((o) => notBefore(o.issueDate, o.validUntil), validUntilAfterIssue);
export type QuoteCreateInput = z.infer<typeof quoteCreateSchema>;

// Only draft quotes are editable; lines replace wholesale when provided.
export const quoteUpdateSchema = z
  .object({
    issueDate: optionalDate,
    validUntil: optionalDate,
    terms: optionalLongText,
    notes: optionalLongText,
    dealId: z.preprocess(emptyToUndefined, z.string().uuid().nullable().optional()),
    lines: z.array(documentLineInput).min(1).max(200).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" })
  .refine((o) => notBefore(o.issueDate, o.validUntil), validUntilAfterIssue);
export type QuoteUpdateInput = z.infer<typeof quoteUpdateSchema>;

export const quoteStatusSchema = z.object({
  action: z.enum(["send", "accept", "reject"]),
});
export type QuoteStatusInput = z.infer<typeof quoteStatusSchema>;

export const orderUpdateSchema = z
  .object({
    status: z.enum(["open", "confirmed", "fulfilled", "cancelled"]).optional(),
    expectedDelivery: optionalDate,
    notes: optionalLongText,
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;

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
