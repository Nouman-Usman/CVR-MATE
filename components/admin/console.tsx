"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Admin console design system — a light "register readout" language.
   Ink numerals (Manrope), JetBrains Mono for every label/figure/timestamp,
   hairline structure instead of shadowed cards. Shared by every admin page so
   the whole console reads as one instrument. Colours are passed via inline
   `style` (hex) on purpose — keeps arbitrary-opacity utilities out of the lint.
─────────────────────────────────────────────────────────────────────────── */

import Link from "next/link";
import { Loader2, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Tokens ──────────────────────────────────────────────────────────────── */
export const INK = "#0B1220";
export const PAPER = "#F6F8FC";
export const HAIR = "#E3E9F2";
export const MUTE = "#64748B";
export const POS = "#059669";
export const WARN = "#B45309";
export const NEG = "#E11D48";
export const CYAN = "#0891B2";

export const PLAN_COLOR: Record<string, string> = {
  free: "#94A3B8", starter: "#2563EB", professional: "#7C3AED", enterprise: "#0891B2",
};
export const SUBSTATUS_COLOR: Record<string, string> = {
  active: POS, trialing: CYAN, past_due: WARN, canceled: NEG, unpaid: NEG, incomplete: "#94A3B8",
};
export const SYNC_COLOR: Record<string, string> = {
  synced: POS, success: POS, delivered: POS, pending: WARN, deferred: WARN,
  error: NEG, bounced: NEG, spam: NEG, failed: NEG, conflict: "#C2410C", skipped: "#94A3B8",
};
export const PROVIDER_COLOR: Record<string, string> = {
  hubspot: "#EA580C", leadconnector: "#2563EB", pipedrive: "#059669",
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
export const nf = new Intl.NumberFormat("da-DK");
export const dkk = (v?: number) => `kr ${nf.format(v ?? 0)}`;
export const num = (v?: number) => nf.format(v ?? 0);
export const pctStr = (n: number) => `${(n * 100).toFixed(1)}%`;

export function ago(d?: string | null) {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
export function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
export function fmtTime(d?: string | null) {
  return d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

/* ── Page shell + status-line header (the thesis) ────────────────────────── */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full px-8 py-7" style={{ background: PAPER }}>
      <div className="mx-auto max-w-[1360px]">{children}</div>
    </div>
  );
}

type Tone = "ok" | "warn" | "danger" | "neutral";
const TONE_COLOR: Record<Tone, string> = { ok: POS, warn: WARN, danger: NEG, neutral: MUTE };

export function StatusHeader({
  tone = "neutral", pulse, eyebrow, title, children,
}: {
  tone?: Tone; pulse?: boolean; eyebrow: string; title: string; children?: React.ReactNode;
}) {
  const c = TONE_COLOR[tone];
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5" style={{ borderColor: HAIR }}>
      <div className="flex items-center gap-3.5">
        <span className="relative mt-1 flex size-2 shrink-0">
          {pulse && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: c }} />}
          <span className="relative inline-flex size-2 rounded-full" style={{ background: c }} />
        </span>
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: c }}>{eyebrow}</p>
          <h1 className="mt-0.5 text-xl font-black tracking-tight" style={{ color: INK }}>{title}</h1>
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function RefreshButton({ onClick, isFetching, generatedAt }: { onClick: () => void; isFetching: boolean; generatedAt?: string }) {
  return (
    <button onClick={onClick} disabled={isFetching}
      className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-500 transition-colors hover:text-slate-900"
      style={{ borderColor: HAIR }}>
      <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
      {generatedAt ? `synced ${ago(generatedAt)} ago` : "sync"}
    </button>
  );
}

/* ── Vitals ledger ───────────────────────────────────────────────────────── */
export function Ledger({ caption, children }: { caption?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border" style={{ borderColor: HAIR }}>
      {caption && (
        <div className="flex items-center gap-2 border-b bg-slate-50/60 px-5 py-2" style={{ borderColor: HAIR }}>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Vitals</span>
          <span className="font-mono text-[10px] text-slate-400">· {caption}</span>
        </div>
      )}
      {children}
    </div>
  );
}
export function LedgerTier({ children, cols = 4, top }: { children: React.ReactNode; cols?: 3 | 4 | 5 | 6; top?: boolean }) {
  const gridCols = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5", 6: "sm:grid-cols-6" }[cols];
  return (
    <div className={cn("grid grid-cols-2 gap-px", gridCols, top && "border-t")} style={{ background: HAIR, borderColor: HAIR }}>
      {children}
    </div>
  );
}
export function StatCell({
  label, value, delta, sub, href, big, danger,
}: {
  label: string; value: string; delta?: number | null; sub?: string; href?: string; big?: boolean; danger?: boolean;
}) {
  const body = (
    <div className="group h-full bg-white px-5 py-4 transition-colors hover:bg-slate-50/80">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
        {href && <ArrowUpRight size={12} className="text-slate-300 transition-colors group-hover:text-slate-500" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={cn("font-black tabular-nums leading-none", big ? "text-[2rem]" : "text-2xl")}
          style={{ color: danger && value !== "0" ? NEG : INK }}>
          {value}
        </span>
        {typeof delta === "number" && (
          <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: delta > 0 ? POS : delta < 0 ? NEG : MUTE }}>
            {delta > 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-slate-400">{sub ?? " "}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/* ── Panels + breakdowns ─────────────────────────────────────────────────── */
export function Panel({
  title, meta, right, children, className,
}: {
  title: string; meta?: string; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-white", className)} style={{ borderColor: HAIR }}>
      <header className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: HAIR }}>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600">{title}</h2>
        {right ?? (meta && <span className="font-mono text-[10px] text-slate-400">{meta}</span>)}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function RankRow({ label, value, max, color, trailing }: { label: string; value: number; max: number; color: string; trailing?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate font-mono text-[11px] text-slate-600">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max((value / (max || 1)) * 100, 2)}%`, background: color }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums" style={{ color: INK }}>{nf.format(value)}</span>
      {trailing && <span className="w-9 shrink-0 text-right font-mono text-[10px] text-slate-400">{trailing}</span>}
    </div>
  );
}

export function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
      style={{ color, background: `${color}14` }}>
      {children}
    </span>
  );
}

/* ── Tables ──────────────────────────────────────────────────────────────── */
export function ConsoleTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b" style={{ borderColor: HAIR }}>
            {head.map((h, i) => (
              <th key={i} className={cn("pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400",
                i === head.length - 1 && head.length > 1 ? "text-right" : "text-left")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const rowClass = "border-b transition-colors hover:bg-slate-50/70";
export const rowStyle = { borderColor: HAIR };

/* ── Action button ───────────────────────────────────────────────────────── */
export function ActionButton({
  onClick, busy, disabled, tone = "neutral", children,
}: {
  onClick: () => void; busy?: boolean; disabled?: boolean; tone?: "neutral" | "danger" | "primary"; children: React.ReactNode;
}) {
  const style =
    tone === "danger" ? { borderColor: "#FBD5DE", color: NEG }
    : tone === "primary" ? { borderColor: INK, color: "#FFFFFF", background: INK }
    : { borderColor: HAIR };
  return (
    <button onClick={onClick} disabled={busy || disabled}
      className={cn("inline-flex items-center justify-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors disabled:opacity-50",
        tone === "neutral" && "text-slate-600 hover:text-slate-900", tone === "primary" && "hover:opacity-90")}
      style={style}>
      {busy ? <Loader2 size={12} className="animate-spin" /> : null}{children}
    </button>
  );
}

/* ── States ──────────────────────────────────────────────────────────────── */
export function ErrorBar({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border px-5 py-3.5" style={{ borderColor: "#FBD5DE", background: "#FEF2F4" }}>
      <p className="font-mono text-[12px]" style={{ color: NEG }}>{message}</p>
      <button onClick={onRetry} className="font-mono text-[11px] font-bold underline" style={{ color: NEG }}>retry</button>
    </div>
  );
}
export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] text-slate-400">{children}</p>;
}
export function StripeLink({ id }: { id: string | null }) {
  if (!id) return null;
  const test = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").includes("_test_");
  return (
    <a href={`https://dashboard.stripe.com/${test ? "test/" : ""}customers/${id}`} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-blue-600 hover:underline">
      stripe <ArrowUpRight size={11} />
    </a>
  );
}
