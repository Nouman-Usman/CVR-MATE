import "server-only";

import { z } from "zod";
import { searchCompaniesElasticsearch } from "@/lib/cvr-api-elasticsearch";
import { regionZipcodeMap } from "@/lib/denmark-geodata";
import { reserveMonthlyQuota } from "@/lib/stripe/entitlements";
import { workspaceFrom } from "@/lib/workspace/types";
import type { AgentTool } from "../types";
import { AgentQuotaError } from "../errors";

const REGIONS = ["hovedstaden", "sjaelland", "syddanmark", "midtjylland", "nordjylland"] as const;
const FOUNDED_PERIODS = ["last30", "last90", "last365", "last3y"] as const;

const FOUNDED_DAYS: Record<(typeof FOUNDED_PERIODS)[number], number> = {
  last30: 30,
  last90: 90,
  last365: 365,
  last3y: 1095,
};

const searchSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Company name or free-text name fragment to match."),
  city: z.string().optional().describe("City / postal district name, e.g. 'København' or 'Aarhus'."),
  zipcode: z.string().optional().describe("A single 4-digit Danish postal code, e.g. '2100'."),
  region: z
    .enum(REGIONS)
    .optional()
    .describe(
      "One of the five Danish regions. Expands to that region's full postal-code range. Ignored if `zipcode` is set."
    ),
  municipalityCode: z.string().optional().describe("Numeric Danish municipality (kommune) code."),
  street: z.string().optional().describe("Street name (vejnavn)."),
  industryCode: z
    .string()
    .optional()
    .describe(
      "NACE industry code as a prefix: 2 digits matches a whole sector (e.g. '62' = IT), up to 6 digits for an exact sub-industry."
    ),
  industrySecondaryCode: z
    .string()
    .optional()
    .describe("Secondary NACE industry code (prefix match), for companies with a registered side-industry."),
  companyFormCode: z
    .string()
    .optional()
    .describe("Numeric company-form code (virksomhedsform), e.g. 60 = A/S, 80 = ApS."),
  companyStatus: z
    .string()
    .optional()
    .describe(
      "Company status text to match, e.g. 'NORMAL', 'AKTIV', 'OPHØRT', 'UNDERKONKURS'. Omit to return only active companies (the default)."
    ),
  foundedPeriod: z
    .enum(FOUNDED_PERIODS)
    .optional()
    .describe("Only companies founded within this recent window (last 30/90/365 days or last 3 years)."),
  excludeMarketingOptOut: z
    .boolean()
    .optional()
    .describe("When true, exclude companies that have opted out of marketing contact (reklamebeskyttet)."),
  page: z.number().int().min(1).max(1000).optional().describe("1-based page number. Default 1."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("Results per page, 1–25. Default 10."),
});

type SearchInput = z.infer<typeof searchSchema>;

function buildFilters(input: SearchInput): Record<string, string> {
  const f: Record<string, string> = {};
  if (input.query) f.life_name = input.query;

  // zipcode wins over region (mirrors buildSearchParamsFromState)
  if (input.zipcode) {
    f.address_zipcode = input.zipcode;
  } else if (input.region) {
    const zips = regionZipcodeMap[input.region];
    if (zips) f.zipcode_list = zips;
  }

  if (input.city) f.city = input.city;
  if (input.municipalityCode) f.municipality = input.municipalityCode;
  if (input.street) f.street = input.street;
  if (input.industryCode) f.industry_primary_code = input.industryCode;
  if (input.industrySecondaryCode) f.industry_secondary_code = input.industrySecondaryCode;
  if (input.companyFormCode) f.companyform_code = input.companyFormCode;
  if (input.companyStatus) f.company_status_code = input.companyStatus;
  if (input.foundedPeriod) {
    const days = FOUNDED_DAYS[input.foundedPeriod];
    f.life_start = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
  }
  if (input.excludeMarketingOptOut) f.life_adprotected = "true";
  return f;
}

const searchCompaniesTool: AgentTool<SearchInput> = {
  name: "search_companies",
  kind: "read",
  description:
    "Search the Danish CVR register for companies by name, location (city, zipcode, or region), NACE industry, company form, status, and founding period. Returns a ranked page of matching companies with their VAT (CVR) numbers. Use this for all company discovery.",
  schema: searchSchema,
  async execute(input, ctx) {
    const filters = buildFilters(input);
    if (Object.keys(filters).length === 0) {
      return {
        data: { error: "At least one search filter is required (name, location, industry, etc.)." },
        isError: true,
      };
    }

    const quota = await reserveMonthlyQuota(
      ctx.userId,
      "company_search",
      workspaceFrom(ctx.userId, ctx.organizationId)
    );
    if (!quota.allowed) {
      throw new AgentQuotaError(
        `Company-search limit reached (${quota.used}/${quota.limit}). Upgrade your plan for more searches.`
      );
    }

    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 10;
    const result = await searchCompaniesElasticsearch(filters, page, pageSize);

    const companies = result.companies.map((c) => ({
      vat: c.vat,
      name: c.name,
      city: c.city,
      industry: c.industry,
      industryCode: c.industryCode,
      status: c.status,
      founded: c.founded,
      employees: c.employees,
      form: c.form,
    }));

    return {
      data: { total: result.total, hasMore: result.hasMore, page, count: companies.length, companies },
      display: { kind: "companies", companies },
      summary: `${companies.length} of ${result.total} companies`,
    };
  },
};

export const searchTools: AgentTool[] = [searchCompaniesTool as AgentTool];
