import "server-only";

import { z } from "zod";
import { getCompanyByVat, getParticipantByNumber } from "@/lib/cvr-api";
import { getUserBrand } from "@/lib/get-user-brand";
import { reserveMonthlyQuota, type MonthlyFeature } from "@/lib/stripe/entitlements";
import { generateCompanyBriefing } from "@/lib/ai/company-briefing";
import { generateOutreach } from "@/lib/ai/draft-outreach";
import { generateCompanyEnrichment } from "@/lib/ai/enrich-company";
import { generatePersonEnrichment } from "@/lib/ai/enrich-person";
import { generateTodoSuggestions } from "@/lib/ai/suggest-todos";
import { analyzePipeline } from "@/lib/ai/analyze-pipeline";
import type { AgentContext, AgentTool, AgentToolResult } from "../types";
import { AgentQuotaError } from "../errors";

/** Reserve a monthly-feature quota unit; throw AgentQuotaError if exhausted. */
async function reserveOrThrow(ctx: AgentContext, feature: MonthlyFeature, label: string): Promise<void> {
  const quota = await reserveMonthlyQuota(ctx.userId, feature);
  if (!quota.allowed) {
    throw new AgentQuotaError(`${label} limit reached (${quota.used}/${quota.limit}). Upgrade your plan for more.`);
  }
}

// ─── company_briefing ────────────────────────────────────────────────────────
const briefingSchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
});

const companyBriefingTool: AgentTool<z.infer<typeof briefingSchema>> = {
  name: "company_briefing",
  kind: "read",
  description:
    "Generate a concise AI sales briefing for a company (by VAT): what it does, financial health, growth signals, and a suggested approach. Use to prep for outreach to a specific company.",
  schema: briefingSchema,
  async execute(input, ctx): Promise<AgentToolResult> {
    await reserveOrThrow(ctx, "ai_usage", "AI usage");
    try {
      const company = await getCompanyByVat(input.vat);
      const brand = await getUserBrand(ctx.userId);
      const result = await generateCompanyBriefing({ company, locale: ctx.locale, brand });
      return { data: result, display: { kind: "briefing", vat: input.vat, briefing: result }, summary: "briefing ready" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Briefing failed" }, isError: true };
    }
  },
};

// ─── draft_outreach ──────────────────────────────────────────────────────────
const outreachSchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
  type: z
    .enum(["email", "linkedin", "phone_script"])
    .describe("Outreach channel: cold email, LinkedIn connection message, or phone-call script."),
  tone: z.string().optional().describe("Tone, e.g. 'formal' or 'casual'. Defaults to the user's brand tone."),
  sellingPoint: z.string().optional().describe("What the user is selling. Defaults to the user's brand products."),
  targetRole: z.string().optional().describe("Role or name of the person to address, e.g. 'CEO' or 'Jens'."),
});

const draftOutreachTool: AgentTool<z.infer<typeof outreachSchema>> = {
  name: "draft_outreach",
  kind: "read",
  description:
    "Draft a personalized outreach message (email, LinkedIn message, or phone script) for a company, grounded in its CVR data and the user's brand. Returns subject (email only), message, and a follow-up.",
  schema: outreachSchema,
  async execute(input, ctx): Promise<AgentToolResult> {
    const feature: MonthlyFeature =
      input.type === "linkedin" ? "linkedin_draft" : input.type === "phone_script" ? "phone_draft" : "email_draft";
    await reserveOrThrow(ctx, feature, "Draft");
    try {
      const company = await getCompanyByVat(input.vat);
      const brand = await getUserBrand(ctx.userId);
      const sellingPoint = input.sellingPoint || brand?.products || "";
      const tone = input.tone || brand?.tone || "formal";
      const result = await generateOutreach({
        company,
        type: input.type,
        tone,
        sellingPoint,
        targetRole: input.targetRole,
        locale: ctx.locale,
        brand,
      });
      return { data: result, display: { kind: "outreach", vat: input.vat, type: input.type, outreach: result }, summary: `${input.type} drafted` };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Outreach failed" }, isError: true };
    }
  },
};

// ─── enrich_company ──────────────────────────────────────────────────────────
const enrichCompanySchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
});

const enrichCompanyTool: AgentTool<z.infer<typeof enrichCompanySchema>> = {
  name: "enrich_company",
  kind: "read",
  description:
    "Produce a full AI enrichment profile for a company (by VAT): summary, lead score (A–D), financial health, buying signals, pain points, competitive landscape, risk factors, and the ideal approach.",
  schema: enrichCompanySchema,
  async execute(input, ctx): Promise<AgentToolResult> {
    await reserveOrThrow(ctx, "enrichment", "Enrichment");
    try {
      const company = await getCompanyByVat(input.vat);
      const brand = await getUserBrand(ctx.userId);
      const result = await generateCompanyEnrichment({ company, locale: ctx.locale, brand });
      return { data: result, display: { kind: "enrichment", entity: "company", vat: input.vat, enrichment: result }, summary: "enrichment ready" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Enrichment failed" }, isError: true };
    }
  },
};

// ─── enrich_person ───────────────────────────────────────────────────────────
const enrichPersonSchema = z.object({
  participantNumber: z.number().int().describe("The person's numeric CVR participant id."),
  personName: z.string().optional().describe("The person's name, if already known."),
});

const enrichPersonTool: AgentTool<z.infer<typeof enrichPersonSchema>> = {
  name: "enrich_person",
  kind: "read",
  description:
    "Produce a full AI enrichment profile for a business person (by participant number): professional summary, role significance, network influence, career trajectory, and an engagement strategy.",
  schema: enrichPersonSchema,
  async execute(input, ctx): Promise<AgentToolResult> {
    await reserveOrThrow(ctx, "enrichment", "Enrichment");
    try {
      const person = await getParticipantByNumber(input.participantNumber);
      const companies = person.roles ?? person.participations ?? [];
      const result = await generatePersonEnrichment({
        participantNumber: input.participantNumber,
        personName: input.personName ?? person.life?.name,
        personData: person,
        companies,
        locale: ctx.locale,
        brand: await getUserBrand(ctx.userId),
      });
      return { data: result, display: { kind: "enrichment", entity: "person", participantNumber: input.participantNumber, enrichment: result }, summary: "enrichment ready" };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Enrichment failed" }, isError: true };
    }
  },
};

// ─── analyze_pipeline ────────────────────────────────────────────────────────
const analyzePipelineSchema = z.object({
  vats: z
    .array(z.number().int())
    .min(1)
    .max(25)
    .describe("Up to 25 company VAT (CVR) numbers to prioritize as a pipeline."),
});

const analyzePipelineTool: AgentTool<z.infer<typeof analyzePipelineSchema>> = {
  name: "analyze_pipeline",
  kind: "read",
  description:
    "Analyze a set of companies (by VAT) as a sales pipeline: prioritize each (high/medium/low with a reason), group them into segments, and suggest one next action per company.",
  schema: analyzePipelineSchema,
  async execute(input, ctx): Promise<AgentToolResult> {
    await reserveOrThrow(ctx, "ai_usage", "AI usage");
    try {
      const brand = await getUserBrand(ctx.userId);
      const outcome = await analyzePipeline({ vats: input.vats, locale: ctx.locale, brand });
      if (!outcome.ok) {
        return { data: { error: "No valid companies found for the given VAT numbers." }, isError: true };
      }
      return { data: outcome.result, display: { kind: "pipeline", pipeline: outcome.result }, summary: `${outcome.result.prioritized.length} companies prioritized` };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Pipeline analysis failed" }, isError: true };
    }
  },
};

// ─── suggest_todos ───────────────────────────────────────────────────────────
const suggestTodosSchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
});

const suggestTodosTool: AgentTool<z.infer<typeof suggestTodosSchema>> = {
  name: "suggest_todos",
  kind: "read",
  description:
    "Suggest 3–5 concrete follow-up tasks for a company (by VAT), each with a title, description, priority, and due-in-days. These are suggestions only — use create_todo to actually add one.",
  schema: suggestTodosSchema,
  async execute(input, ctx): Promise<AgentToolResult> {
    await reserveOrThrow(ctx, "ai_task_suggest", "AI task-suggestion");
    try {
      const company = await getCompanyByVat(input.vat);
      const brand = await getUserBrand(ctx.userId);
      const result = await generateTodoSuggestions({ company, locale: ctx.locale, brand });
      return { data: result, display: { kind: "todos", vat: input.vat, suggestions: result.suggestions }, summary: `${result.suggestions.length} tasks suggested` };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : "Suggestion failed" }, isError: true };
    }
  },
};

export const aiAnalysisTools: AgentTool[] = [
  companyBriefingTool as AgentTool,
  draftOutreachTool as AgentTool,
  enrichCompanyTool as AgentTool,
  enrichPersonTool as AgentTool,
  analyzePipelineTool as AgentTool,
  suggestTodosTool as AgentTool,
];
