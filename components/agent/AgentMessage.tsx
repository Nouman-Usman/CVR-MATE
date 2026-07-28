"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UiMessage } from "@/lib/hooks/use-search-agent";
import { ToolTrace } from "./ToolTrace";
import { CompanyResults, companiesFromDisplay, type AgentCompany } from "./CompanyResults";

export function AgentMessage({ message }: { message: UiMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm">
          <p className="whitespace-pre-wrap wrap-break-word">{message.text}</p>
        </div>
      </div>
    );
  }

  // Collect company cards surfaced by this turn's tools (dedup by VAT).
  const companies: AgentCompany[] = [];
  const seen = new Set<number>();
  for (const t of message.tools) {
    const found = companiesFromDisplay(t.display);
    if (found) {
      for (const c of found) {
        if (!seen.has(c.vat)) {
          seen.add(c.vat);
          companies.push(c);
        }
      }
    }
  }

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {message.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.tools.map((t) => (
              <ToolTrace key={t.id} entry={t} />
            ))}
          </div>
        )}
        {message.text && (
          <div
            className={cn(
              "prose prose-sm max-w-none text-sm leading-relaxed text-foreground",
              "whitespace-pre-wrap wrap-break-word"
            )}
          >
            {message.text}
          </div>
        )}
        {companies.length > 0 && <CompanyResults companies={companies} />}
      </div>
    </div>
  );
}
