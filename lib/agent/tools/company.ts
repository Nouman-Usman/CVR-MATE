import "server-only";

import { z } from "zod";
import { getCompanyByVat, suggestCompanies, type CvrCompany } from "@/lib/cvr-api";
import type { AgentTool } from "../types";

/** Curate the (large) CvrCompany into a compact, token-efficient profile. */
function curateCompany(c: CvrCompany) {
  const latestAccounting = c.accounting?.documents?.[0]?.summary ?? null;
  const years = c.employment?.years ?? [];
  const latestEmployment = years.length
    ? years.reduce((a, b) => (b.year > a.year ? b : a))
    : null;

  return {
    vat: c.vat,
    name: c.life.name,
    status: c.companystatus.text,
    founded: c.life.start,
    dissolved: c.life.end,
    address: {
      street: c.address.street,
      zipcode: c.address.zipcode,
      city: c.address.cityname,
      municipality: c.address.municipalityname,
    },
    form: c.companyform.description,
    industry: {
      primary: c.industry.primary,
      secondary: c.industry.secondary?.map((s) => ({ code: s.code, text: s.text })) ?? [],
    },
    contact: c.contact,
    bankrupt: c.status.bankrupt,
    capital: c.info ? { amount: c.info.capital_amount, currency: c.info.capital_currency } : null,
    purpose: c.info?.purpose ?? null,
    latestAccounting,
    latestEmployment,
    participantCount: c.participants?.length ?? 0,
  };
}

const getCompanySchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
});

const getCompanyTool: AgentTool<z.infer<typeof getCompanySchema>> = {
  name: "get_company",
  kind: "read",
  description:
    "Fetch the full profile of a single Danish company by its VAT (CVR) number: address, company form, status, contact details, primary and secondary industries, capital, purpose, latest accounting summary, and employment. Use after a search to dig into a specific company.",
  schema: getCompanySchema,
  async execute(input) {
    try {
      const company = await getCompanyByVat(input.vat);
      const curated = curateCompany(company);
      return { data: curated, display: { kind: "company", company: curated }, summary: curated.name ?? String(input.vat) };
    } catch {
      return { data: { error: `No company found for VAT ${input.vat}.` }, isError: true };
    }
  },
};

const suggestSchema = z.object({
  name: z.string().min(2).describe("Partial company name to autocomplete (at least 2 characters)."),
});

const suggestCompaniesTool: AgentTool<z.infer<typeof suggestSchema>> = {
  name: "suggest_companies",
  kind: "read",
  description:
    "Autocomplete company names. Given a partial name, returns candidate companies with their VAT numbers. Use to resolve a name the user typed into an exact company before calling get_company.",
  schema: suggestSchema,
  async execute(input) {
    const results = await suggestCompanies(input.name);
    const companies = results.map((c) => ({
      vat: c.vat,
      name: c.life?.name ?? null,
      city: c.address?.cityname ?? null,
      status: c.companystatus?.text ?? null,
    }));
    return {
      data: { count: companies.length, companies },
      display: { kind: "companies", companies },
      summary: `${companies.length} suggestions`,
    };
  },
};

export const companyTools: AgentTool[] = [getCompanyTool as AgentTool, suggestCompaniesTool as AgentTool];
