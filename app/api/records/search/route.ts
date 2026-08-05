import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@/db";
import { company, companyWorkspace, savedCompany, contact } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { blindIndex, blindIndexPhone } from "@/lib/pii/crypto";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * GET /api/records/search?q= — search the org/user's OWN records: companies it
 * has claimed into a workspace OR saved, plus its contacts. Distinct from
 * /api/cvr/search, which queries the whole CVR register.
 *
 * The query is classified so each shape hits the right index:
 *   - contains "@"          → exact email (contact.emailHash blind index)
 *   - phone-like digits     → exact phone (contact.phoneHash blind index)
 *   - bare 8 digits         → CVR exact (owned/saved company) + phone (both)
 *   - anything else         → fuzzy ILIKE on company.name + contact.name
 *
 * Blind indexes are exact-match only, so email/phone need the full value; names
 * are substring. Workspace matches are org-scoped; saved matches are the current
 * user's. No DB-level RLS — every query filters explicitly.
 */

const RESULT_LIMIT = 8;
const MAX_Q = 200;

type Mode = "email" | "phone" | "cvr" | "name" | "empty";

interface CompanyHit {
  vat: string;
  name: string;
  city: string | null;
  status: string | null; // workspace pipeline status, or null when only saved
  saved: boolean;
}
interface ContactHit {
  id: string;
  name: string;
  title: string | null;
  companyVat: string;
  companyName: string;
}

/** Merge workspace + saved company results, deduped by CVR (workspace wins). */
function mergeCompanies(
  workspace: { vat: string; name: string; city: string | null; status: string }[],
  saved: { vat: string; name: string; city: string | null }[]
): CompanyHit[] {
  const byVat = new Map<string, CompanyHit>();
  for (const w of workspace) {
    byVat.set(w.vat, { vat: w.vat, name: w.name, city: w.city, status: w.status, saved: false });
  }
  for (const s of saved) {
    const existing = byVat.get(s.vat);
    if (existing) existing.saved = true;
    else byVat.set(s.vat, { vat: s.vat, name: s.name, city: s.city, status: null, saved: true });
  }
  return Array.from(byVat.values()).slice(0, RESULT_LIMIT);
}

export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "records_search", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_Q);
    if (q.length < 2) {
      return NextResponse.json({ query: q, mode: "empty" as Mode, companies: [], contacts: [] });
    }

    const digitsOnly = q.replace(/\D/g, "");
    const isEmail = q.includes("@");
    const isNumeric = digitsOnly.length >= 6 && /^[+\d\s()\-.]+$/.test(q);

    // ── Own companies (workspace = org-scoped, saved = user-scoped) ────────────
    const workspaceByCvr = (vat: string) =>
      db
        .select({
          vat: company.vat,
          name: company.name,
          city: company.city,
          status: companyWorkspace.status,
        })
        .from(companyWorkspace)
        .innerJoin(company, eq(companyWorkspace.companyId, company.id))
        .where(and(eq(companyWorkspace.organizationId, organizationId), eq(company.vat, vat)))
        .limit(RESULT_LIMIT);

    const workspaceByName = (like: string) =>
      db
        .select({
          vat: company.vat,
          name: company.name,
          city: company.city,
          status: companyWorkspace.status,
        })
        .from(companyWorkspace)
        .innerJoin(company, eq(companyWorkspace.companyId, company.id))
        .where(and(eq(companyWorkspace.organizationId, organizationId), ilike(company.name, like)))
        .limit(RESULT_LIMIT);

    const savedByCvr = (vat: string) =>
      db
        .select({ vat: company.vat, name: company.name, city: company.city })
        .from(savedCompany)
        .innerJoin(company, eq(savedCompany.companyId, company.id))
        .where(
          and(
            eq(savedCompany.userId, userId),
            isNull(savedCompany.deletedAt),
            eq(company.vat, vat)
          )
        )
        .limit(RESULT_LIMIT);

    const savedByName = (like: string) =>
      db
        .select({ vat: company.vat, name: company.name, city: company.city })
        .from(savedCompany)
        .innerJoin(company, eq(savedCompany.companyId, company.id))
        .where(
          and(
            eq(savedCompany.userId, userId),
            isNull(savedCompany.deletedAt),
            ilike(company.name, like)
          )
        )
        .limit(RESULT_LIMIT);

    // ── Org contacts ──────────────────────────────────────────────────────────
    const contactsByHash = (
      col: typeof contact.emailHash | typeof contact.phoneHash,
      hash: string
    ) =>
      db
        .select({
          id: contact.id,
          name: contact.name,
          title: contact.title,
          companyVat: company.vat,
          companyName: company.name,
        })
        .from(contact)
        .innerJoin(company, eq(contact.companyId, company.id))
        .where(
          and(
            eq(contact.organizationId, organizationId),
            isNull(contact.deletedAt),
            eq(col, hash)
          )
        )
        .limit(RESULT_LIMIT);

    const contactsByName = (like: string) =>
      db
        .select({
          id: contact.id,
          name: contact.name,
          title: contact.title,
          companyVat: company.vat,
          companyName: company.name,
        })
        .from(contact)
        .innerJoin(company, eq(contact.companyId, company.id))
        .where(
          and(
            eq(contact.organizationId, organizationId),
            isNull(contact.deletedAt),
            ilike(contact.name, like)
          )
        )
        .limit(RESULT_LIMIT);

    let mode: Mode;
    let companies: CompanyHit[] = [];
    let contacts: ContactHit[] = [];

    if (isEmail) {
      mode = "email";
      const hash = blindIndex(q);
      if (hash) contacts = await contactsByHash(contact.emailHash, hash);
    } else if (isNumeric) {
      const bareEight = /^\d{8}$/.test(digitsOnly) && !q.includes("+");
      const phoneHash = blindIndexPhone(q);
      if (bareEight) {
        mode = "cvr";
        const [ws, sv, ph] = await Promise.all([
          workspaceByCvr(digitsOnly),
          savedByCvr(digitsOnly),
          phoneHash ? contactsByHash(contact.phoneHash, phoneHash) : Promise.resolve([] as ContactHit[]),
        ]);
        companies = mergeCompanies(ws, sv);
        contacts = ph;
      } else {
        mode = "phone";
        if (phoneHash) contacts = await contactsByHash(contact.phoneHash, phoneHash);
      }
    } else {
      mode = "name";
      // Escape LIKE wildcards so user input is a literal substring.
      const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      const [ws, sv, ct] = await Promise.all([
        workspaceByName(like),
        savedByName(like),
        contactsByName(like),
      ]);
      companies = mergeCompanies(ws, sv);
      contacts = ct;
    }

    return NextResponse.json({ query: q, mode, companies, contacts });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
