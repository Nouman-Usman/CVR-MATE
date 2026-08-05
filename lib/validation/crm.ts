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
// Whole DKK (kroner), integer — matches contract.value semantics + formatDKK.
const optionalWholeAmount = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(0).max(1e15).nullish()
);

export const contractCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  status: contractStatus.optional(),
  startDate: optionalDate,
  expiryDate: optionalDate,
  value: optionalWholeAmount,
  currency: z.string().trim().length(3).optional(),
  renewalNoticeDays: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(365).optional()
  ),
  autoRenew: z.boolean().optional(),
  externalRef: optionalShortText,
  notes: optionalLongText,
  dealId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});
export type ContractCreateInput = z.infer<typeof contractCreateSchema>;

export const contractUpdateSchema = contractCreateSchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
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
const oreAmount = z.coerce.number().int().min(0).max(1e15);
const percent = z.coerce.number().min(0).max(100);

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

const documentLineInput = z.object({
  productId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  description: z.string().trim().min(1, "Line description is required").max(500),
  quantity: z.coerce.number().min(0).max(1e9),
  unitPrice: oreAmount, // øre
  discountPct: percent.optional(),
  vatRate: percent.optional(),
});
export type DocumentLineInput = z.infer<typeof documentLineInput>;

export const quoteCreateSchema = z
  .object({
    companyId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    cvr: optionalShortText,
    dealId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    issueDate: optionalDate,
    validUntil: optionalDate,
    terms: optionalLongText,
    notes: optionalLongText,
    lines: z.array(documentLineInput).min(1, "At least one line is required").max(200),
  })
  .refine((o) => o.companyId || o.cvr, {
    message: "Either companyId or cvr is required",
  });
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
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
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
