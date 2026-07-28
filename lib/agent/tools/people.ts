import "server-only";

import { z } from "zod";
import { getCompanyByVat, getParticipantByNumber } from "@/lib/cvr-api";
import type { AgentTool } from "../types";

const getParticipantSchema = z.object({
  participantNumber: z
    .number()
    .int()
    .describe("The participant's numeric CVR participant id (participantnumber)."),
});

const getParticipantTool: AgentTool<z.infer<typeof getParticipantSchema>> = {
  name: "get_participant",
  kind: "read",
  description:
    "Look up a person (participant) in the CVR register by their participant number. Returns the person's name and profession plus every company they are affiliated with and their role in each. Use to profile an officer or owner across companies.",
  schema: getParticipantSchema,
  async execute(input) {
    try {
      const p = await getParticipantByNumber(input.participantNumber);
      const affiliations = p.roles ?? p.participations ?? [];
      // Dedup company affiliations by VAT, collecting the person's role types.
      const byVat = new Map<number, { vat: number; name: string; status: string | null; roles: string[] }>();
      for (const a of affiliations) {
        const existing = byVat.get(a.vat);
        const roleTypes = (a.roles ?? []).map((r) => r.type);
        if (existing) {
          existing.roles.push(...roleTypes);
        } else {
          byVat.set(a.vat, {
            vat: a.vat,
            name: a.life?.name ?? "",
            status: a.companystatus?.text ?? null,
            roles: roleTypes,
          });
        }
      }
      const companies = [...byVat.values()].map((c) => ({ ...c, roles: [...new Set(c.roles)] }));
      const data = {
        participantNumber: p.participantnumber,
        name: p.life?.name ?? null,
        profession: p.life?.profession ?? null,
        deceased: p.life?.deceased ?? false,
        companyCount: companies.length,
        companies,
      };
      return { data, display: { kind: "participant", participant: data }, summary: data.name ?? String(input.participantNumber) };
    } catch {
      return { data: { error: `No participant found for number ${input.participantNumber}.` }, isError: true };
    }
  },
};

const getCompanyPeopleSchema = z.object({
  vat: z.number().int().describe("The company's 8-digit VAT (CVR) number."),
});

const getCompanyPeopleTool: AgentTool<z.infer<typeof getCompanyPeopleSchema>> = {
  name: "get_company_people",
  kind: "read",
  description:
    "List the officers, owners, and other registered participants of a company (by VAT number): each person's name, participant number, roles, title, and ownership percentage where available. Use to find who to contact at a company.",
  schema: getCompanyPeopleSchema,
  async execute(input) {
    try {
      const company = await getCompanyByVat(input.vat);
      const participants = company.participants ?? [];
      // A person with several roles appears as multiple entries — merge by participant number.
      const byId = new Map<
        number,
        { participantNumber: number; name: string; profession: string | null; roles: string[]; title: string | null; ownerPercent: number | null }
      >();
      for (const p of participants) {
        const id = p.participantnumber ?? -1;
        const role = p.roles;
        const existing = byId.get(id);
        if (existing) {
          if (role?.type) existing.roles.push(role.type);
          if (!existing.title && role?.life?.title) existing.title = role.life.title;
          if (existing.ownerPercent == null && role?.life?.owner_percent != null)
            existing.ownerPercent = role.life.owner_percent;
        } else {
          byId.set(id, {
            participantNumber: id,
            name: p.life?.name ?? "",
            profession: p.life?.profession ?? null,
            roles: role?.type ? [role.type] : [],
            title: role?.life?.title ?? null,
            ownerPercent: role?.life?.owner_percent ?? null,
          });
        }
      }
      const people = [...byId.values()].map((p) => ({ ...p, roles: [...new Set(p.roles)] }));
      return {
        data: { vat: input.vat, count: people.length, people },
        display: { kind: "people", vat: input.vat, people },
        summary: `${people.length} people`,
      };
    } catch {
      return { data: { error: `No company found for VAT ${input.vat}.` }, isError: true };
    }
  },
};

export const peopleTools: AgentTool[] = [getParticipantTool as AgentTool, getCompanyPeopleTool as AgentTool];
