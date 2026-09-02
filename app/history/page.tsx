"use client";

import { useState } from "react";
import Link from "next/link";
import {
  History,
  Inbox,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import RequiresOrganization from "@/components/workspace/requires-organization";
import { useWorkspaces } from "@/lib/hooks/use-workspace";
import { useTr } from "@/lib/i18n/tr";
import { ListSkeleton, QueryError, EmptyState } from "@/components/crm/QueryState";
import { Field } from "@/components/crm/Field";
import { inputCls } from "@/components/company/crm/shared";
import {
  useActivityFeed,
  useActivityActors,
  type ActivityEvent,
  type ActivityFilters,
} from "@/lib/hooks/use-activity-feed";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  type ActivityAction,
  type ActivityEntityType,
} from "@/lib/activity/vocabulary";
import type { Tr } from "@/components/company/crm/shared";

const PAGE_SIZE = 50;

function entityLabel(type: string, tr: Tr): string {
  switch (type) {
    case "company": return tr("Virksomhed", "Company");
    case "person": return tr("Person", "Person");
    case "todo": return tr("Opgave", "Task");
    case "note": return tr("Note", "Note");
    case "contact": return tr("Kontakt", "Contact");
    case "interaction": return tr("Interaktion", "Interaction");
    case "contract": return tr("Kontrakt", "Contract");
    case "segment": return tr("Segment", "Segment");
    case "product": return tr("Produkt", "Product");
    case "quote": return tr("Tilbud", "Quote");
    case "order": return tr("Ordre", "Order");
    case "deal": return tr("Handel", "Deal");
    case "pipeline": return tr("Pipeline", "Pipeline");
    case "stage": return tr("Fase", "Stage");
    case "trigger": return tr("Trigger", "Trigger");
    case "crm_sync": return tr("CRM-sync", "CRM sync");
    default: return type;
  }
}

function actionLabel(action: string, tr: Tr): string {
  switch (action) {
    case "created": return tr("oprettet", "created");
    case "updated": return tr("opdateret", "updated");
    case "deleted": return tr("slettet", "deleted");
    case "synced": return tr("synkroniseret", "synced");
    case "exported": return tr("eksporteret", "exported");
    case "saved": return tr("gemt", "saved");
    case "unsaved": return tr("fjernet fra gemte", "unsaved");
    case "followed": return tr("fulgt", "followed");
    case "unfollowed": return tr("stoppet med at følge", "unfollowed");
    case "stage_changed": return tr("flyttet fase", "moved stage");
    case "won": return tr("vundet", "won");
    case "lost": return tr("tabt", "lost");
    default: return action;
  }
}

/**
 * Destructive actions are what people open a history for. Colouring them is the
 * difference between a log and something you can scan.
 */
function actionTone(action: string): string {
  if (action === "deleted" || action === "lost") return "text-destructive";
  if (action === "created" || action === "won") return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

/**
 * A human label for the affected record, pulled from whichever metadata key the
 * writing route happened to set. The shapes differ per entity (`number` for
 * documents, `title` for contracts, `name` for contacts) because each route
 * logs what is useful for it; this reads them all rather than forcing one shape
 * on fifteen call sites.
 */
function subjectOf(event: ActivityEvent): string | null {
  const m = event.metadata;
  for (const key of ["number", "title", "name", "subject"]) {
    const value = m[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export default function HistoryPage() {
  const { tr, locale } = useTr();
  const { isPersonal } = useWorkspaces();

  const [entityType, setEntityType] = useState<ActivityEntityType | "">("");
  const [action, setAction] = useState<ActivityAction | "">("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);

  const filters: ActivityFilters = {
    entityType: entityType ? [entityType] : undefined,
    action: action ? [action] : undefined,
    userId: userId || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const { data, isLoading, isError, error, refetch, isPlaceholderData } =
    useActivityFeed(filters);
  const { data: actorData } = useActivityActors();

  const events = data?.activity ?? [];
  const total = data?.total ?? 0;
  const hasFilters = !!(entityType || action || userId || from || to);

  // Every control resets paging: staying on page 7 of a filter that now returns
  // three rows shows an empty table and reads as "no results".
  function change<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setOffset(0);
    };
  }

  function reset() {
    setEntityType("");
    setAction("");
    setUserId("");
    setFrom("");
    setTo("");
    setOffset(0);
  }

  // This page's data is NOT NULL organization-scoped, so in the personal
  // workspace the API refuses it. Returning here — before any data-dependent
  // branch — is what stops a refusal being rendered as "nothing here yet",
  // which reads as a fact about the business rather than about the workspace.
  if (isPersonal) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <RequiresOrganization feature={tr("Historik", "History")} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <History className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">
              {tr("Historik", "History")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr(
                "Hvem ændrede hvad, og hvornår — på tværs af hele organisationen.",
                "Who changed what, and when — across the whole organisation."
              )}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <Field label={tr("Type", "Type")}>
              <select
                className={inputCls}
                value={entityType}
                onChange={(e) => change(setEntityType)(e.target.value as ActivityEntityType | "")}
              >
                <option value="">{tr("Alle typer", "All types")}</option>
                {ACTIVITY_ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>{entityLabel(t, tr)}</option>
                ))}
              </select>
            </Field>

            <Field label={tr("Handling", "Action")}>
              <select
                className={inputCls}
                value={action}
                onChange={(e) => change(setAction)(e.target.value as ActivityAction | "")}
              >
                <option value="">{tr("Alle handlinger", "All actions")}</option>
                {ACTIVITY_ACTIONS.map((a) => (
                  <option key={a} value={a}>{actionLabel(a, tr)}</option>
                ))}
              </select>
            </Field>

            <Field label={tr("Person", "Person")}>
              <select
                className={inputCls}
                value={userId}
                onChange={(e) => change(setUserId)(e.target.value)}
              >
                <option value="">{tr("Alle", "Everyone")}</option>
                {(actorData?.actors ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || tr("Ukendt bruger", "Unknown user")}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={tr("Fra", "From")}>
              <input
                type="date"
                className={inputCls}
                value={from}
                max={to || undefined}
                onChange={(e) => change(setFrom)(e.target.value)}
              />
            </Field>

            <Field label={tr("Til", "To")}>
              <input
                type="date"
                className={inputCls}
                value={to}
                min={from || undefined}
                onChange={(e) => change(setTo)(e.target.value)}
              />
            </Field>
          </div>

          {hasFilters && (
            <button
              onClick={reset}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              {tr("Nulstil filtre", "Clear filters")}
            </button>
          )}
        </div>

        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6 text-muted-foreground" />}
            title={
              hasFilters
                ? tr("Ingen hændelser matcher filtrene.", "No events match these filters.")
                : tr("Ingen historik endnu.", "No history yet.")
            }
            description={
              hasFilters
                ? tr("Prøv en bredere periode eller nulstil filtrene.", "Try a wider date range or clear the filters.")
                : tr(
                    "Handlinger i CRM'et bliver logget her, efterhånden som de sker.",
                    "CRM actions are recorded here as they happen."
                  )
            }
            action={
              hasFilters ? (
                <button onClick={reset} className="text-sm font-semibold text-primary hover:underline cursor-pointer">
                  {tr("Nulstil filtre", "Clear filters")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div
              className={
                "rounded-xl border border-border divide-y divide-border transition-opacity " +
                // Paging keeps the previous page on screen; dimming it says
                // "loading" without the layout collapsing to a spinner.
                (isPlaceholderData ? "opacity-60" : "")
              }
            >
              {events.map((e) => {
                const subject = subjectOf(e);
                return (
                  <div key={e.id} className="p-3 sm:p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">
                          {e.actor?.name || tr("Ukendt bruger", "Unknown user")}
                        </span>{" "}
                        <span className={actionTone(e.action)}>{actionLabel(e.action, tr)}</span>{" "}
                        <span className="text-muted-foreground">
                          {entityLabel(e.entityType, tr).toLowerCase()}
                        </span>
                        {subject && (
                          <span className="font-medium text-foreground"> · {subject}</span>
                        )}
                      </p>
                      {e.companyVat && (
                        <Link
                          href={`/company/${e.companyVat}`}
                          className="group inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                        >
                          CVR {e.companyVat}
                          <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      )}
                    </div>
                    <time
                      dateTime={e.createdAt}
                      // Full timestamp, not a relative "2 days ago": an audit
                      // trail is read to answer "exactly when", and the list is
                      // already ordered so relative time adds nothing.
                      className="text-[11px] text-muted-foreground shrink-0 tabular-nums"
                    >
                      {new Date(e.createdAt).toLocaleString(locale === "da" ? "da-DK" : "en-GB", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                {tr(
                  `Viser ${offset + 1}–${offset + events.length} af ${total}`,
                  `Showing ${offset + 1}–${offset + events.length} of ${total}`
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-muted"
                >
                  <ChevronLeft className="size-3.5" />
                  {tr("Forrige", "Previous")}
                </button>
                <button
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  disabled={offset + events.length >= total}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-muted"
                >
                  {tr("Næste", "Next")}
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
