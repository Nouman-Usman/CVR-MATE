"use client";

import { Lock } from "lucide-react";
import type { MaskedCompanyPreview } from "@/lib/chat-landing/masking";

const MASKED_FIELDS = [
  { label: "Email", width: "w-20" },
  { label: "Phone", width: "w-14" },
  { label: "Revenue", width: "w-16" },
];

export function MaskedPreviewCard({ company }: { company: MaskedCompanyPreview }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{company.name}</p>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            VAT {company.vat} · {company.industry ?? "—"}
          </p>
        </div>
        {company.companyStatus && (
          <span className="shrink-0 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
            {company.companyStatus}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {company.address.zipcode} {company.address.cityname}
      </p>

      <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-x-4 gap-y-1.5">
        {MASKED_FIELDS.map((field) => (
          <div key={field.label} className="flex items-center gap-1.5">
            <Lock className="size-2.5 text-slate-600" />
            <span className="text-[10px] text-slate-500">{field.label}</span>
            <span className={`h-1.5 ${field.width} rounded-full bg-white/10 blur-[1px]`} />
          </div>
        ))}
      </div>
    </div>
  );
}
