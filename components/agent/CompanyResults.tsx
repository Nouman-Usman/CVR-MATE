"use client";

import Link from "next/link";
import { ArrowUpRight, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgentCompany {
  vat: number;
  name: string | null;
  city?: string | null;
  industry?: string | null;
  status?: string | null;
  founded?: string | null;
  employees?: string | null;
  form?: string | null;
}

/** Extract a company list from a tool's `display` payload, if it carries one. */
export function companiesFromDisplay(display: unknown): AgentCompany[] | null {
  if (!display || typeof display !== "object") return null;
  const d = display as { kind?: string; companies?: unknown };
  if ((d.kind === "companies" || d.kind === "company") && !d.companies) {
    const single = (display as { company?: AgentCompany }).company;
    return single ? [single] : null;
  }
  if (Array.isArray(d.companies)) return d.companies as AgentCompany[];
  return null;
}

export function CompanyResults({ companies }: { companies: AgentCompany[] }) {
  if (!companies.length) return null;
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {companies.map((c) => (
        <Link
          key={c.vat}
          href={`/company/${c.vat}`}
          className={cn(
            "group flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors",
            "hover:border-blue-300 hover:bg-blue-50/40"
          )}
        >
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">{c.name ?? `VAT ${c.vat}`}</span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>CVR {c.vat}</span>
              {c.city && <span>· {c.city}</span>}
              {c.form && <span>· {c.form}</span>}
            </div>
            {(c.industry || c.status) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                {c.industry && <span className="truncate text-muted-foreground/90">{c.industry}</span>}
                {c.status && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {c.status}
                  </span>
                )}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
