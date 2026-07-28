import "server-only";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { crmConnection } from "@/db/schema";
import { checkEntitlement, checkUsageEntitlement } from "@/lib/stripe/entitlements";
import { logActivity } from "@/lib/activity/log";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import { getCrmClient } from "@/lib/crm";
import { executeRichPush } from "@/lib/crm/rich-push";
import type { CrmProvider } from "@/lib/crm/types";
import { countSavedCompanies, saveCompany, unsaveCompany } from "@/lib/saved-companies";
import { createTodo } from "@/lib/todos";
import { createSavedSearch } from "@/lib/saved-searches";
import { countActiveTriggers, createLeadTrigger } from "@/lib/lead-triggers";
import { createCompanyNote } from "@/lib/company-notes";
import { countActiveFollows, followPerson } from "@/lib/followed-people";
import type { AgentTool, AgentToolResult } from "../types";
import { AgentQuotaError } from "../errors";

function dueDateFromDays(days?: number): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  return new Date(Date.now() + Math.max(0, days) * 86_400_000).toISOString().split("T")[0];
}

// ─── save_company / unsave_company ───────────────────────────────────────────
const saveSchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
  note: z.string().optional().describe("Optional note to attach to the saved company."),
});

const saveCompanyTool: AgentTool<z.infer<typeof saveSchema>> = {
  name: "save_company",
  kind: "write",
  description:
    "Save a company (by VAT) to the user's saved-companies list, optionally with a note. Requires the user's confirmation.",
  schema: saveSchema,
  confirmSummary: (input) => `Save company CVR ${input.vat} to your saved companies`,
  async execute(input, ctx): Promise<AgentToolResult> {
    const gate = await checkUsageEntitlement(ctx.userId, "savedCompanies", await countSavedCompanies(ctx.userId));
    if (!gate.allowed) {
      throw new AgentQuotaError(`Saved-companies limit reached (${gate.limit}). Upgrade your plan for more.`);
    }
    try {
      const result = await saveCompany(ctx.userId, ctx.organizationId, input.vat, input.note);
      if (result.status === "invalid_vat") return { data: { error: "Invalid VAT — must be 8 digits." }, isError: true };
      if (result.status === "not_found") return { data: { error: `No company found for VAT ${input.vat}.` }, isError: true };
      if (result.status === "already_saved") return { data: { alreadySaved: true }, summary: "already saved" };
      await logActivity({
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        entityType: "company",
        entityId: result.companyId,
        action: "saved",
        metadata: { vat: input.vat },
      });
      return { data: { saved: true }, summary: "saved" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Save failed" }, isError: true };
    }
  },
};

const unsaveSchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
});

const unsaveCompanyTool: AgentTool<z.infer<typeof unsaveSchema>> = {
  name: "unsave_company",
  kind: "write",
  description: "Remove a company (by VAT) from the user's saved-companies list. Requires the user's confirmation.",
  schema: unsaveSchema,
  confirmSummary: (input) => `Remove company CVR ${input.vat} from your saved companies`,
  async execute(input, ctx): Promise<AgentToolResult> {
    try {
      await unsaveCompany(ctx.userId, input.vat);
      await logActivity({
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        entityType: "company",
        entityId: null,
        action: "unsaved",
        metadata: { vat: input.vat },
      });
      return { data: { removed: true }, summary: "removed" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Remove failed" }, isError: true };
    }
  },
};

// ─── create_todo ─────────────────────────────────────────────────────────────
const todoSchema = z.object({
  title: z.string().min(1).describe("Task title."),
  description: z.string().optional().describe("Optional task details."),
  priority: z.enum(["low", "medium", "high"]).optional().describe("Priority. Defaults to medium."),
  companyVat: z.number().int().optional().describe("Optional company VAT (CVR) to attach the task to."),
  dueInDays: z.number().int().optional().describe("Optional due date, expressed as days from today."),
});

const createTodoTool: AgentTool<z.infer<typeof todoSchema>> = {
  name: "create_todo",
  kind: "write",
  description:
    "Create a follow-up task (to-do), optionally attached to a company and with a due date. Requires the user's confirmation.",
  schema: todoSchema,
  confirmSummary: (input) => `Create task "${input.title}"${input.companyVat ? ` for CVR ${input.companyVat}` : ""}`,
  async execute(input, ctx): Promise<AgentToolResult> {
    try {
      const todo = await createTodo(ctx.userId, ctx.organizationId, {
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "medium",
        cvr: input.companyVat != null ? String(input.companyVat) : null,
        dueDate: dueDateFromDays(input.dueInDays),
      });
      if (todo?.id) {
        await logActivity({
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          entityType: "todo",
          entityId: todo.id,
          action: "created",
          metadata: input.companyVat != null ? { vat: input.companyVat } : {},
        });
      }
      return { data: { created: true, id: todo?.id ?? null, title: input.title }, summary: "task created" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Task creation failed" }, isError: true };
    }
  },
};

// ─── create_saved_search ─────────────────────────────────────────────────────
const savedSearchSchema = z.object({
  name: z.string().min(1).describe("A name for the saved search."),
  filters: z
    .record(z.string(), z.unknown())
    .describe("The search filters to save, using the same fields as search_companies (name, region, industryCode, etc.)."),
});

const createSavedSearchTool: AgentTool<z.infer<typeof savedSearchSchema>> = {
  name: "create_saved_search",
  kind: "write",
  description: "Save a set of search filters under a name so the user can re-run it later. Requires the user's confirmation.",
  schema: savedSearchSchema,
  confirmSummary: (input) => `Save the search "${input.name}"`,
  async execute(input, ctx): Promise<AgentToolResult> {
    try {
      const created = await createSavedSearch(ctx.userId, ctx.organizationId, input.name, input.filters);
      return { data: { created: true, id: created?.id ?? null, name: input.name }, summary: "search saved" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Saving search failed" }, isError: true };
    }
  },
};

// ─── create_lead_trigger ─────────────────────────────────────────────────────
const triggerSchema = z.object({
  name: z.string().min(1).describe("A name for the lead trigger."),
  filters: z
    .record(z.string(), z.unknown())
    .describe("The search filters the trigger watches, using the same fields as search_companies."),
  frequency: z.enum(["daily", "weekly"]).optional().describe("How often the trigger runs. Defaults to daily."),
  scheduledHour: z.number().int().min(0).max(23).optional().describe("Hour of day to run (0–23). Defaults to 8."),
  scheduledDayOfWeek: z.number().int().min(0).max(6).optional().describe("Day of week for weekly triggers (0=Sun…6=Sat)."),
});

const createLeadTriggerTool: AgentTool<z.infer<typeof triggerSchema>> = {
  name: "create_lead_trigger",
  kind: "write",
  description:
    "Create a scheduled lead trigger that periodically searches for new companies matching filters and notifies the user. Requires the user's confirmation.",
  schema: triggerSchema,
  confirmSummary: (input) => `Create ${input.frequency ?? "daily"} lead trigger "${input.name}"`,
  async execute(input, ctx): Promise<AgentToolResult> {
    const gate = await checkUsageEntitlement(ctx.userId, "triggers", await countActiveTriggers(ctx.userId));
    if (!gate.allowed) {
      throw new AgentQuotaError(`Lead-trigger limit reached (${gate.limit}). Upgrade your plan for more.`);
    }
    try {
      const trigger = await createLeadTrigger(ctx.userId, ctx.organizationId, {
        name: input.name,
        filters: input.filters,
        frequency: input.frequency,
        scheduledHour: input.scheduledHour,
        scheduledDayOfWeek: input.scheduledDayOfWeek,
      });
      await logActivity({
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        entityType: "trigger",
        entityId: trigger.id,
        action: "created",
        metadata: {},
      });
      return { data: { created: true, id: trigger.id, name: input.name }, summary: "trigger created" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Trigger creation failed" }, isError: true };
    }
  },
};

// ─── create_company_note ─────────────────────────────────────────────────────
const noteSchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
  content: z.string().min(1).describe("The note text (stored encrypted at rest)."),
});

const createCompanyNoteTool: AgentTool<z.infer<typeof noteSchema>> = {
  name: "create_company_note",
  kind: "write",
  description:
    "Add an internal note to a company (by VAT). Notes are a team feature — requires an active organization. Requires the user's confirmation.",
  schema: noteSchema,
  confirmSummary: (input) => `Add a note to company CVR ${input.vat}`,
  async execute(input, ctx): Promise<AgentToolResult> {
    if (!ctx.organizationId) {
      return { data: { error: "Company notes require an active team/organization." }, isError: true };
    }
    try {
      const companyId = await resolveCompanyIdByVat(String(input.vat));
      if (!companyId) return { data: { error: `No company found for VAT ${input.vat}.` }, isError: true };
      const row = await createCompanyNote(ctx.userId, ctx.organizationId, companyId, input.content);
      await logActivity({
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        entityType: "note",
        entityId: row.id,
        action: "created",
        metadata: { companyId, vat: input.vat },
      });
      return { data: { created: true, id: row.id }, summary: "note added" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Note creation failed" }, isError: true };
    }
  },
};

// ─── follow_person ───────────────────────────────────────────────────────────
const followSchema = z.object({
  participantNumber: z.number().int().describe("The person's numeric CVR participant id."),
  name: z.string().min(1).describe("The person's name."),
  fromVat: z.number().int().optional().describe("Optional VAT of the company this person was found at."),
});

const followPersonTool: AgentTool<z.infer<typeof followSchema>> = {
  name: "follow_person",
  kind: "write",
  description:
    "Follow a business person (by participant number) to track their role and company changes over time. Requires the user's confirmation.",
  schema: followSchema,
  confirmSummary: (input) => `Follow ${input.name} (participant ${input.participantNumber})`,
  async execute(input, ctx): Promise<AgentToolResult> {
    const gate = await checkUsageEntitlement(ctx.userId, "followedPeople", await countActiveFollows(ctx.userId));
    if (!gate.allowed) {
      throw new AgentQuotaError(`Follow limit reached (${gate.limit}). Upgrade your plan for more.`);
    }
    try {
      const result = await followPerson(
        ctx.userId,
        input.participantNumber,
        input.name,
        input.fromVat != null ? String(input.fromVat) : null
      );
      return { data: result, summary: result.status.replace("_", " ") };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Follow failed" }, isError: true };
    }
  },
};

// ─── push_to_crm ─────────────────────────────────────────────────────────────
const pushCrmSchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
});

const pushToCrmTool: AgentTool<z.infer<typeof pushCrmSchema>> = {
  name: "push_to_crm",
  kind: "write",
  description:
    "Push a company (by VAT) to the user's connected CRM, including contacts and enrichment. Requires an active CRM connection and the user's confirmation.",
  schema: pushCrmSchema,
  confirmSummary: (input) => `Push company CVR ${input.vat} to your connected CRM`,
  async execute(input, ctx): Promise<AgentToolResult> {
    const gate = await checkEntitlement(ctx.userId, "crm");
    if (!gate.allowed) {
      throw new AgentQuotaError("CRM sync requires the Professional or Enterprise plan.");
    }
    try {
      const companyId = await resolveCompanyIdByVat(String(input.vat));
      if (!companyId) return { data: { error: `No company found for VAT ${input.vat}. Save or open it first.` }, isError: true };

      const conn = await db.query.crmConnection.findFirst({
        where: and(eq(crmConnection.userId, ctx.userId), eq(crmConnection.isActive, true)),
      });
      if (!conn) return { data: { error: "No active CRM connection. Connect a CRM in Settings first." }, isError: true };

      const provider = conn.provider as CrmProvider;
      const client = await getCrmClient(conn.id, provider);
      const result = await executeRichPush(client, companyId, conn.id, ctx.userId, provider);

      await logActivity({
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        entityType: "crm_sync",
        entityId: null,
        action: "synced",
        metadata: { companyId, vat: input.vat, provider },
      });
      return { data: { pushed: true, provider, ...result }, summary: `pushed to ${provider}` };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "CRM push failed" }, isError: true };
    }
  },
};

export const actionTools: AgentTool[] = [
  saveCompanyTool as AgentTool,
  unsaveCompanyTool as AgentTool,
  createTodoTool as AgentTool,
  createSavedSearchTool as AgentTool,
  createLeadTriggerTool as AgentTool,
  createCompanyNoteTool as AgentTool,
  followPersonTool as AgentTool,
  pushToCrmTool as AgentTool,
];
