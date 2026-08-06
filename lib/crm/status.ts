/**
 * The single status vocabulary for CRM documents: colour + Danish/English label
 * per status, per document kind.
 *
 * Four near-identical style maps were copy-pasted across page files, two of them
 * *exported from `page.tsx` route modules* and imported by detail pages via
 * `../page` — arbitrary exports from App Router page modules are unsupported
 * surface and coupled every detail page to its list page. Worse, none of them
 * had labels, so a Danish-first product rendered the raw enum: "draft", "sent",
 * "fulfilled", "churned".
 */

export type StatusKind = "quote" | "order" | "contract" | "workspace";

interface StatusMeta {
  className: string;
  da: string;
  en: string;
}

const NEUTRAL = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
const INFO = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
const SUCCESS = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
const DANGER = "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
const WARNING = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
const SPECIAL = "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";

const STATUS: Record<StatusKind, Record<string, StatusMeta>> = {
  quote: {
    draft: { className: NEUTRAL, da: "Kladde", en: "Draft" },
    sent: { className: INFO, da: "Sendt", en: "Sent" },
    accepted: { className: SUCCESS, da: "Accepteret", en: "Accepted" },
    rejected: { className: DANGER, da: "Afvist", en: "Rejected" },
    expired: { className: WARNING, da: "Udløbet", en: "Expired" },
    converted: { className: SPECIAL, da: "Konverteret", en: "Converted" },
  },
  order: {
    open: { className: INFO, da: "Åben", en: "Open" },
    confirmed: { className: SUCCESS, da: "Bekræftet", en: "Confirmed" },
    fulfilled: { className: SPECIAL, da: "Leveret", en: "Fulfilled" },
    cancelled: { className: DANGER, da: "Annulleret", en: "Cancelled" },
  },
  contract: {
    draft: { className: NEUTRAL, da: "Kladde", en: "Draft" },
    active: { className: SUCCESS, da: "Aktiv", en: "Active" },
    expired: { className: DANGER, da: "Udløbet", en: "Expired" },
    cancelled: { className: NEUTRAL, da: "Annulleret", en: "Cancelled" },
    renewed: { className: INFO, da: "Fornyet", en: "Renewed" },
  },
  workspace: {
    prospect: { className: NEUTRAL, da: "Emne", en: "Prospect" },
    lead: { className: INFO, da: "Lead", en: "Lead" },
    qualified: { className: SPECIAL, da: "Kvalificeret", en: "Qualified" },
    customer: { className: SUCCESS, da: "Kunde", en: "Customer" },
    churned: { className: DANGER, da: "Mistet", en: "Churned" },
  },
};

/** Localized label for a status, falling back to the raw value if unknown. */
export function statusLabel(kind: StatusKind, status: string, locale: "da" | "en"): string {
  const meta = STATUS[kind]?.[status];
  if (!meta) return status;
  return locale === "da" ? meta.da : meta.en;
}

/** Tailwind classes for a status pill. */
export function statusClassName(kind: StatusKind, status: string): string {
  return STATUS[kind]?.[status]?.className ?? NEUTRAL;
}

/** Every status a kind can hold — drives filter chips without a second list. */
export function statusValues(kind: StatusKind): string[] {
  return Object.keys(STATUS[kind] ?? {});
}
