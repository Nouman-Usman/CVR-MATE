"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  FileWarning,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { useApiErrorMessage, useTr } from "@/lib/i18n/tr";
import { formatDate, formatNumber, formatOre } from "@/lib/format";
import { ApiError, fetchJson, jsonRequest } from "@/lib/api/fetch-json";
import type { QuoteSnapshot } from "@/lib/quotes/snapshot";

/** Exactly what GET /api/public/quotes/[token] returns — no ids, no org. */
interface PublicQuoteView {
  snapshot: QuoteSnapshot;
  status: string;
  canRespond: boolean;
  expired: boolean;
  respondedAt: string | null;
}

type Action = "accept" | "reject";

export default function PublicQuotePage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const { tr, locale } = useTr();
  const { toggleLocale } = useLanguage();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const queryKey = ["public-quote", token];

  const { data, isPending, error } = useQuery<PublicQuoteView>({
    queryKey,
    queryFn: () => fetchJson<PublicQuoteView>(`/api/public/quotes/${token}`),
    enabled: token.length > 0,
    retry: (count, err) => !(err instanceof ApiError) && count < 1,
  });

  // Which action is awaiting its "are you sure?" confirmation.
  const [pending, setPending] = useState<Action | null>(null);
  // Set only when *this* visitor answered, so the thank-you copy can differ
  // from the copy shown to someone re-opening an already-answered link.
  const [justAnswered, setJustAnswered] = useState<Action | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const respond = useMutation({
    mutationFn: (action: Action) =>
      fetchJson<{ status: string }>(
        `/api/public/quotes/${token}/respond`,
        jsonRequest("POST", { action })
      ),
    onSuccess: (res, action) => {
      setPending(null);
      setFailure(null);
      setJustAnswered(action);
      queryClient.setQueryData<PublicQuoteView>(queryKey, (prev) =>
        prev
          ? {
              ...prev,
              status: res.status,
              canRespond: false,
              respondedAt: new Date().toISOString(),
            }
          : prev
      );
    },
    onError: (err) => {
      setPending(null);
      setFailure(errorMessage(err));
      // A 409 means the real state moved on (answered elsewhere, or expired).
      // Re-read it rather than leaving buttons that cannot work.
      if (err instanceof ApiError && err.isConflict) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const langToggle = (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={tr("Skift til engelsk", "Switch to Danish")}
      className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {locale === "da" ? "EN" : "DA"}
    </button>
  );

  if (!token || (error && !data)) {
    return (
      <Shell langToggle={langToggle} footer={tr("Sendt via CVR-MATE", "Sent via CVR-MATE")}>
        <StateCard
          icon={<FileWarning className="size-7" aria-hidden="true" />}
          tone="neutral"
          title={tr("Tilbuddet blev ikke fundet", "Quote not found")}
          description={tr(
            "Linket er ugyldigt, udløbet eller trukket tilbage. Kontakt afsenderen for at få et nyt link.",
            "This link is invalid, withdrawn, or no longer available. Contact the sender for a new link."
          )}
        />
      </Shell>
    );
  }

  if (isPending || !data) {
    return (
      <Shell langToggle={langToggle} footer={tr("Sendt via CVR-MATE", "Sent via CVR-MATE")}>
        <DocumentSkeleton label={tr("Henter tilbud…", "Loading quote…")} />
      </Shell>
    );
  }

  const { snapshot } = data;
  const answered =
    data.status === "accepted" || data.status === "converted"
      ? "accepted"
      : data.status === "rejected"
        ? "rejected"
        : null;

  return (
    <Shell langToggle={langToggle} footer={tr("Sendt via CVR-MATE", "Sent via CVR-MATE")}>
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">
            {tr("Tilbud fra", "Quote from")}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl font-[family-name:var(--font-manrope)]">
            {snapshot.seller.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr("Tilbudsnr.", "Quote no.")} {snapshot.number}
          </p>
        </header>

        <QuoteDocument snapshot={snapshot} locale={locale} tr={tr} />

        <section aria-live="polite">
          {answered === "accepted" && (
            <StatusPanel
              tone="positive"
              icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
              title={
                justAnswered
                  ? tr("Tak — tilbuddet er accepteret", "Thank you — the quote is accepted")
                  : tr("Tilbuddet er accepteret", "This quote has been accepted")
              }
              description={
                justAnswered
                  ? tr(
                      "Afsenderen er underrettet og kontakter dig med de næste skridt.",
                      "The sender has been notified and will follow up with the next steps."
                    )
                  : tr(
                      `Accepteret ${formatDate(data.respondedAt, locale)}.`,
                      `Accepted on ${formatDate(data.respondedAt, locale)}.`
                    )
              }
            />
          )}

          {answered === "rejected" && (
            <StatusPanel
              tone="neutral"
              icon={<XCircle className="size-5" aria-hidden="true" />}
              title={
                justAnswered
                  ? tr("Tilbuddet er afvist", "The quote has been declined")
                  : tr("Tilbuddet blev afvist", "This quote was declined")
              }
              description={
                justAnswered
                  ? tr(
                      "Tak for svaret. Afsenderen er underrettet.",
                      "Thank you for responding. The sender has been notified."
                    )
                  : tr(
                      `Afvist ${formatDate(data.respondedAt, locale)}.`,
                      `Declined on ${formatDate(data.respondedAt, locale)}.`
                    )
              }
            />
          )}

          {!answered && data.expired && (
            <StatusPanel
              tone="warning"
              icon={<CalendarClock className="size-5" aria-hidden="true" />}
              title={tr("Tilbuddet er udløbet", "This quote has expired")}
              description={tr(
                `Tilbuddet var gyldigt til ${formatDate(snapshot.validUntil, locale)} og kan ikke længere accepteres. Kontakt afsenderen for et opdateret tilbud.`,
                `This offer was valid until ${formatDate(snapshot.validUntil, locale)} and can no longer be accepted. Contact the sender for an updated quote.`
              )}
            />
          )}

          {!answered && !data.expired && data.canRespond && (
            <ResponsePanel
              tr={tr}
              pending={pending}
              busy={respond.isPending}
              failure={failure}
              onRequest={(action) => {
                setFailure(null);
                setPending(action);
              }}
              onCancel={() => setPending(null)}
              onConfirm={(action) => respond.mutate(action)}
            />
          )}

          {!answered && !data.expired && !data.canRespond && (
            <StatusPanel
              tone="neutral"
              icon={<AlertCircle className="size-5" aria-hidden="true" />}
              title={tr("Afventer afsenderen", "Awaiting the sender")}
              description={tr(
                "Dette tilbud er ikke åbent for svar lige nu. Kontakt afsenderen, hvis du forventede at kunne svare.",
                "This quote is not open for a response right now. Contact the sender if you expected to be able to respond."
              )}
            />
          )}
        </section>
      </div>
    </Shell>
  );
}

/* ─── Document ──────────────────────────────────────────────────────────── */

function QuoteDocument({
  snapshot,
  locale,
  tr,
}: {
  snapshot: QuoteSnapshot;
  locale: string;
  tr: (da: string, en: string) => string;
}) {
  const { seller, customer } = snapshot;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <AccentBar color={seller.color} />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Party
            heading={tr("Afsender", "From")}
            name={seller.name}
            lines={[
              seller.address,
              seller.zipCity,
              seller.cvr ? `${tr("CVR", "CVR")} ${seller.cvr}` : null,
              seller.email,
              seller.phone,
              seller.website,
            ]}
          />
          <Party
            heading={tr("Til", "To")}
            name={customer.name}
            lines={[
              customer.contactName,
              customer.address,
              customer.zipCity,
              customer.cvr ? `${tr("CVR", "CVR")} ${customer.cvr}` : null,
              customer.contactEmail,
            ]}
          />
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border pt-5 sm:grid-cols-3">
          <Meta label={tr("Tilbudsnummer", "Quote number")} value={snapshot.number} />
          <Meta
            label={tr("Udstedt", "Issued")}
            value={snapshot.issueDate ? formatDate(snapshot.issueDate, locale) : "–"}
          />
          <Meta
            label={tr("Gyldigt til", "Valid until")}
            value={snapshot.validUntil ? formatDate(snapshot.validUntil, locale) : "–"}
          />
        </dl>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">
              {tr(
                `Varelinjer for tilbud ${snapshot.number}`,
                `Line items for quote ${snapshot.number}`
              )}
            </caption>
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {tr("Beskrivelse", "Description")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  {tr("Antal", "Qty")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  {tr("Stykpris", "Unit price")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  {tr("Rabat", "Discount")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  {tr("Moms", "VAT")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  {tr("I alt", "Line total")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshot.lines.map((line, i) => (
                <tr key={`${line.description}-${i}`}>
                  <th
                    scope="row"
                    className="px-3 py-2.5 text-left font-normal text-foreground"
                  >
                    {line.description}
                  </th>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {formatNumber(line.quantity, locale)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {formatOre(line.unitPrice, locale)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatNumber(line.discountPct, locale)} %
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatNumber(line.vatRate, locale)} %
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground">
                    {formatOre(line.lineTotal, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* `subtotal` is already net of discount, so the discount is stated as
            context above the sum rather than as a step in it — otherwise the
            column would not add up for the person checking it. */}
        <div className="ml-auto w-full max-w-sm space-y-2 text-sm">
          {snapshot.discountTotal > 0 && (
            <SumRow
              label={tr("Rabat (fratrukket)", "Discount (applied)")}
              value={`−${formatOre(snapshot.discountTotal, locale)}`}
            />
          )}
          <SumRow
            label={tr("Subtotal ekskl. moms", "Subtotal excl. VAT")}
            value={formatOre(snapshot.subtotal, locale)}
          />
          <SumRow label={tr("Moms", "VAT")} value={formatOre(snapshot.vatTotal, locale)} />
          <div className="flex items-baseline justify-between gap-4 border-t-2 border-border pt-3">
            <span className="text-base font-bold text-foreground">
              {tr("Total inkl. moms", "Total incl. VAT")}
            </span>
            <span className="text-2xl font-extrabold tabular-nums text-foreground sm:text-3xl">
              {formatOre(snapshot.total, locale)}
            </span>
          </div>
        </div>

        {(snapshot.terms || snapshot.notes) && (
          <div className="space-y-4 border-t border-border pt-5 text-sm">
            {snapshot.terms && (
              <div>
                <h2 className="mb-1 font-semibold text-foreground">
                  {tr("Betingelser", "Terms")}
                </h2>
                <p className="whitespace-pre-wrap break-words text-muted-foreground">
                  {snapshot.terms}
                </p>
              </div>
            )}
            {snapshot.notes && (
              <div>
                <h2 className="mb-1 font-semibold text-foreground">
                  {tr("Bemærkninger", "Notes")}
                </h2>
                <p className="whitespace-pre-wrap break-words text-muted-foreground">
                  {snapshot.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** Seller-supplied hex, so it is validated before reaching a style attribute. */
function AccentBar({ color }: { color: string | null }) {
  const safe = color && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : null;
  return (
    <div
      className={safe ? "h-1.5 w-full" : "h-1.5 w-full bg-primary"}
      style={safe ? { backgroundColor: safe } : undefined}
    />
  );
}

function Party({
  heading,
  name,
  lines,
}: {
  heading: string;
  name: string;
  lines: (string | null)[];
}) {
  const visible = lines.filter((l): l is string => !!l && l.trim().length > 0);
  return (
    <div className="min-w-0">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h2>
      <p className="mt-1 font-semibold break-words text-foreground">{name}</p>
      {visible.length > 0 && (
        <address className="mt-1 space-y-0.5 text-sm not-italic text-muted-foreground">
          {visible.map((line) => (
            <div key={line} className="break-words">
              {line}
            </div>
          ))}
        </address>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

/* ─── Response ──────────────────────────────────────────────────────────── */

function ResponsePanel({
  tr,
  pending,
  busy,
  failure,
  onRequest,
  onCancel,
  onConfirm,
}: {
  tr: (da: string, en: string) => string;
  pending: Action | null;
  busy: boolean;
  failure: string | null;
  onRequest: (action: Action) => void;
  onCancel: () => void;
  onConfirm: (action: Action) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      {failure && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          {failure}
        </p>
      )}

      {pending === null && (
        <>
          <h2 className="text-base font-bold text-foreground">
            {tr("Dit svar", "Your response")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              "Accepterer du dette tilbud? Du bliver bedt om at bekræfte.",
              "Do you accept this quote? You will be asked to confirm."
            )}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => onRequest("accept")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
            >
              <Check className="size-4" aria-hidden="true" />
              {tr("Accepter tilbud", "Accept quote")}
            </button>
            <button
              type="button"
              onClick={() => onRequest("reject")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
            >
              <X className="size-4" aria-hidden="true" />
              {tr("Afvis tilbud", "Decline quote")}
            </button>
          </div>
        </>
      )}

      {pending !== null && (
        <>
          <h2 className="text-base font-bold text-foreground">
            {pending === "accept"
              ? tr("Bekræft accept", "Confirm acceptance")
              : tr("Bekræft afvisning", "Confirm decline")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {pending === "accept"
              ? tr(
                  "Når du accepterer, er tilbuddet bindende og afsenderen får besked. Handlingen kan ikke fortrydes her.",
                  "Accepting makes this offer binding and notifies the sender. This cannot be undone here."
                )
              : tr(
                  "Afsenderen får besked om, at du har afvist tilbuddet. Handlingen kan ikke fortrydes her.",
                  "The sender will be notified that you declined. This cannot be undone here."
                )}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={() => onConfirm(pending)}
              className={
                "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto " +
                (pending === "accept"
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-destructive text-destructive-foreground hover:opacity-90")
              }
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : pending === "accept" ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <X className="size-4" aria-hidden="true" />
              )}
              {pending === "accept"
                ? tr("Ja, accepter tilbuddet", "Yes, accept the quote")
                : tr("Ja, afvis tilbuddet", "Yes, decline the quote")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
            >
              {tr("Annuller", "Cancel")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Frame & states ────────────────────────────────────────────────────── */

type Tone = "positive" | "warning" | "neutral";

const TONE_RING: Record<Tone, string> = {
  positive: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

function StatusPanel({
  tone,
  icon,
  title,
  description,
}: {
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 sm:p-5 ${TONE_RING[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <h2 className="font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StateCard({
  icon,
  tone,
  title,
  description,
}: {
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-md space-y-5 py-10 text-center">
      <div
        className={`mx-auto flex size-14 items-center justify-center rounded-2xl border ${TONE_RING[tone]}`}
      >
        {icon}
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DocumentSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-56 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1.5 w-full bg-muted" />
        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-40 max-w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 max-w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 max-w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
          <div className="ml-auto h-12 w-48 max-w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

function Shell({
  children,
  langToggle,
  footer,
}: {
  children: React.ReactNode;
  langToggle: React.ReactNode;
  footer: string;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex justify-end">{langToggle}</div>
        {children}
        <footer className="mt-10 border-t border-border pt-5 text-center text-xs text-muted-foreground">
          {footer}
        </footer>
      </div>
    </main>
  );
}
