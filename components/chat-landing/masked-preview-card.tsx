"use client";

import { Lock } from "lucide-react";
import type { MaskedCompanyPreview } from "@/lib/chat-landing/masking";
import { useLanguage } from "@/lib/i18n/language-context";

/* ─── Masked Preview Card ─────────────────────────────────────────
   The chat deals you cards straight from the register, so a preview is
   the same paper register card the marketing hero uses — same stock,
   same emerald status stamp, same mono CVR number. The public fields
   are printed; the fields the trial unlocks sit behind blurred bars,
   so the value is visible but the data genuinely never left the server.
─────────────────────────────────────────────────────────────────── */

const PAPER = "linear-gradient(#F5F8FC, #E4EAF5)";
const INK = "#0B1220";

const CARD_EDGE = {
  borderRadius: "3px",
  boxShadow: [
    "inset 0 1px 0 rgba(255,255,255,0.85)",
    "inset 0 -1px 0 rgba(11,18,32,0.16)",
    "0 1px 2px rgba(0,0,0,0.35)",
    "0 12px 26px -12px rgba(0,0,0,0.7)",
  ].join(", "),
} as const;

export function MaskedPreviewCard({ company }: { company: MaskedCompanyPreview }) {
  const { t } = useLanguage();
  const lockedFields = [
    { label: t.chat.preview.email, width: "w-24" },
    { label: t.chat.preview.phone, width: "w-20" },
    { label: t.chat.preview.revenue, width: "w-16" },
  ];

  return (
    <div style={{ background: PAPER, ...CARD_EDGE }} className="p-4">
      {/* Header — mono CVR number and the live status stamp */}
      <div className="flex items-start justify-between gap-3">
        <span
          className="font-mono text-[12px] font-bold tabular-nums tracking-tight"
          style={{ color: `${INK}8C` }}
        >
          CVR {company.vat}
        </span>
        {company.companyStatus && (
          <span
            className="shrink-0 -rotate-[5deg] border-2 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] opacity-85"
            style={{ borderColor: "#0E7A57", color: "#0E7A57", mixBlendMode: "multiply" }}
          >
            {company.companyStatus}
          </span>
        )}
      </div>

      <h3
        className="mt-1.5 truncate font-[family-name:var(--font-manrope)] text-[17px] font-extrabold uppercase leading-tight tracking-tight"
        style={{ color: INK }}
      >
        {company.name}
      </h3>
      <p
        className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.12em]"
        style={{ color: `${INK}73` }}
      >
        {company.industry ?? "—"} · {company.address.zipcode} {company.address.cityname}
      </p>

      {/* Locked particulars — the fields the trial opens */}
      <div className="mt-3.5 border-t pt-3" style={{ borderColor: `${INK}1F` }}>
        <p
          className="mb-2 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: `${INK}80` }}
        >
          <Lock className="size-2.5" />
          {t.chat.preview.unlocks}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {lockedFields.map((field) => (
            <div key={field.label} className="flex items-center gap-1.5">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.1em]"
                style={{ color: `${INK}66` }}
              >
                {field.label}
              </span>
              <span
                className={`h-2 ${field.width} rounded-sm blur-[2px]`}
                style={{ background: `${INK}26` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
