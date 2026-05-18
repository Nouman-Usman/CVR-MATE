"use client";

import { Info, Lightbulb, AlertTriangle, CircleAlert } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { DocCallout } from "@/lib/docs/types";

const variants = {
  note:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-900",    icon: Info },
  tip:     { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", icon: Lightbulb },
  warning: { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-900",   icon: AlertTriangle },
  info:    { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700",   icon: CircleAlert },
};

export function DocsCallout({ callout }: { callout: DocCallout }) {
  const { locale, t } = useLanguage();
  const v = variants[callout.kind];
  const Icon = v.icon;
  const labelMap = { note: t.docs.calloutNote, tip: t.docs.calloutTip, warning: t.docs.calloutWarning, info: t.docs.calloutInfo };
  const body = (locale === "da" && callout.da) ? callout.da : callout.en;

  return (
    <div className={`rounded-xl border ${v.border} ${v.bg} p-4 flex gap-3 items-start text-sm my-5`}>
      <Icon className={`size-4 mt-0.5 shrink-0 ${v.text}`} />
      <div className={v.text}>
        <span className="font-semibold">{labelMap[callout.kind]}: </span>
        {body}
      </div>
    </div>
  );
}
