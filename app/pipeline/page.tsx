"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSubscription } from "@/lib/hooks/use-subscription";
import { formatDKK, daysSince } from "@/lib/format";
import { useSuggestions } from "@/lib/hooks/use-suggestions";
import { useSavedCompanies } from "@/lib/hooks/use-saved-companies";
import {
  usePipelines,
  useBoard,
  useMoveDeal,
  useCreateDeal,
  useCreatePipeline,
  useUpdatePipeline,
  useDeletePipeline,
  type BoardColumn,
  type BoardDeal,
  type PipelineSummary,
} from "@/lib/hooks/use-pipeline";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400";

export default function PipelinePage() {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { data: sub, isLoading: subLoading } = useSubscription();

  const { data: pipelinesData, isError: pipelinesError, error: pipelinesErrorObj } = usePipelines();
  const pipelines = pipelinesData?.pipelines ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activePipelineId =
    selectedId ?? pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id;
  const activePipeline = pipelines.find((p) => p.id === activePipelineId);

  const { data: board, isLoading } = useBoard(activePipelineId);
  const moveDeal = useMoveDeal(activePipelineId ?? "");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const dealId = String(e.active.id);
    const fromStage = e.active.data.current?.stageId as string | undefined;
    const toStage = e.over ? String(e.over.id) : undefined;
    if (toStage && fromStage && toStage !== fromStage) {
      moveDeal.mutate(
        { dealId, stageId: toStage },
        { onError: (err) => toast.error((err as Error).message) }
      );
    }
  }

  const hasCrm = sub?.limits.teamFeatures ?? false;

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col gap-3 mb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">{tr("Pipeline", "Pipeline")}</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {tr("Administrér dine salgsaftaler", "Manage your sales deals")}
            </p>
          </div>
          {hasCrm && pipelines.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <PipelineSwitcher
                pipelines={pipelines}
                activeId={activePipelineId}
                activePipeline={activePipeline}
                onSelect={setSelectedId}
                tr={tr}
              />
              {activePipelineId && (
                <AddDealButton pipelineId={activePipelineId} tr={tr} />
              )}
            </div>
          )}
        </div>

        {subLoading ? (
          <InlineLoader />
        ) : !hasCrm ? (
          <UpgradeNotice tr={tr} />
        ) : pipelinesError ? (
          <ErrorNotice message={(pipelinesErrorObj as Error)?.message} tr={tr} />
        ) : isLoading || !board ? (
          <InlineLoader />
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none -mx-3 px-3 sm:mx-0 sm:px-0">
              {board.columns.map((col) => (
                <Column key={col.stage.id} column={col} locale={locale} tr={tr} />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </DashboardLayout>
  );
}

function UpgradeNotice({ tr }: { tr: (da: string, en: string) => string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-10 text-center">
      <span className="material-symbols-outlined text-4xl text-blue-500">workspace_premium</span>
      <h2 className="mt-3 text-lg font-bold text-slate-900">
        {tr("CRM kræver Enterprise", "CRM requires Enterprise")}
      </h2>
      <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
        {tr(
          "Den indbyggede CRM og pipeline er tilgængelig på Enterprise-planen.",
          "The built-in CRM and pipeline are available on the Enterprise plan."
        )}
      </p>
      <a
        href="/settings"
        className="inline-block mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
      >
        {tr("Opgradér", "Upgrade")}
      </a>
    </div>
  );
}

function ErrorNotice({
  message,
  tr,
}: {
  message?: string;
  tr: (da: string, en: string) => string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-10 text-center">
      <span className="material-symbols-outlined text-4xl text-amber-500">error_outline</span>
      <h2 className="mt-3 text-lg font-bold text-slate-900">
        {tr("Kunne ikke indlæse pipeline", "Couldn't load pipeline")}
      </h2>
      <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
        {message ||
          tr(
            "Der opstod en fejl. Prøv igen senere.",
            "Something went wrong. Please try again later."
          )}
      </p>
    </div>
  );
}

// ─── Pipeline switcher: select + create/rename/delete ──────────────────────

function PipelineSwitcher({
  pipelines,
  activeId,
  activePipeline,
  onSelect,
  tr,
}: {
  pipelines: PipelineSummary[];
  activeId: string | undefined;
  activePipeline: PipelineSummary | undefined;
  onSelect: (id: string | null) => void;
  tr: (da: string, en: string) => string;
}) {
  const [mode, setMode] = useState<"idle" | "create" | "rename">("idle");
  const [name, setName] = useState("");
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();

  function openRename() {
    setName(activePipeline?.name ?? "");
    setMode("rename");
  }

  function openCreate() {
    setName("");
    setMode("create");
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mode === "create") {
      createPipeline.mutate(trimmed, {
        onSuccess: (data) => {
          if (data?.pipeline?.id) onSelect(data.pipeline.id);
          setMode("idle");
        },
        onError: (err) => toast.error((err as Error).message),
      });
    } else if (mode === "rename" && activeId) {
      updatePipeline.mutate(
        { id: activeId, name: trimmed },
        {
          onSuccess: () => setMode("idle"),
          onError: (err) => toast.error((err as Error).message),
        }
      );
    }
  }

  function handleDelete() {
    if (!activeId || !activePipeline) return;
    if (activePipeline.isDefault) {
      toast.error(tr("Standardpipelinen kan ikke slettes", "Cannot delete the default pipeline"));
      return;
    }
    if (
      !window.confirm(
        tr(
          `Slet pipelinen "${activePipeline.name}"?`,
          `Delete pipeline "${activePipeline.name}"?`
        )
      )
    )
      return;
    deletePipeline.mutate(activeId, {
      onSuccess: () => onSelect(null),
      onError: (err) => toast.error((err as Error).message),
    });
  }

  const busy = createPipeline.isPending || updatePipeline.isPending || deletePipeline.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <select
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white"
          value={activeId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isDefault ? tr(" (standard)", " (default)") : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openRename}
          disabled={!activeId || busy}
          title={tr("Omdøb pipeline", "Rename pipeline")}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">edit</span>
        </button>
        <button
          type="button"
          onClick={openCreate}
          disabled={busy}
          title={tr("Ny pipeline", "New pipeline")}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add</span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!activeId || busy || activePipeline?.isDefault}
          title={tr("Slet pipeline", "Delete pipeline")}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>

      {mode !== "idle" && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setMode("idle")}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">
              {mode === "create"
                ? tr("Ny pipeline", "New pipeline")
                : tr("Omdøb pipeline", "Rename pipeline")}
            </h3>
            <input
              autoFocus
              className={inputCls}
              placeholder={tr("Navn", "Name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setMode("idle")}
                className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold cursor-pointer"
              >
                {tr("Annuller", "Cancel")}
              </button>
              <button
                onClick={submit}
                disabled={busy || !name.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
              >
                {busy ? tr("Gemmer…", "Saving…") : tr("Gem", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Column({
  column,
  locale,
  tr,
}: {
  column: BoardColumn;
  locale: string;
  tr: (da: string, en: string) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });
  const total = column.deals.reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0);

  return (
    <div className="w-[82vw] max-w-[300px] sm:w-72 shrink-0 snap-start">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: column.stage.color ?? "#94a3b8" }}
          />
          <h3 className="text-sm font-semibold text-slate-700 truncate">{column.stage.name}</h3>
          <span className="text-xs text-slate-400 shrink-0">{column.deals.length}</span>
        </div>
        <span className="text-[11px] font-medium text-slate-400 shrink-0">
          {formatDKK(total, locale)}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[120px] rounded-xl p-2 space-y-2 transition-colors ${
          isOver ? "bg-blue-50 ring-2 ring-blue-300" : "bg-slate-50/70"
        }`}
      >
        {column.deals.map((d) => (
          <DealCard key={d.id} deal={d} locale={locale} tr={tr} />
        ))}
        {column.deals.length === 0 && (
          <p className="text-xs text-slate-300 text-center py-6">{tr("Tom", "Empty")}</p>
        )}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  locale,
  tr,
}: {
  deal: BoardDeal;
  locale: string;
  tr: (da: string, en: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stageId: deal.stageId },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
  const days = daysSince(deal.stageChangedAt);
  // Stale-deal nudge: flag deals that haven't moved stage in a while.
  const staleness = days == null ? null : days > 14 ? "red" : days > 7 ? "amber" : null;
  const dayBadgeCls =
    staleness === "red"
      ? "bg-red-50 text-red-600"
      : staleness === "amber"
        ? "bg-amber-50 text-amber-600"
        : "text-slate-400";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.5 : 1 }}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing touch-none ${
        staleness === "red" ? "border-red-200" : "border-slate-100"
      }`}
    >
      <p className="text-sm font-semibold text-slate-900 truncate">{deal.title}</p>
      {deal.company && (
        <p className="text-xs text-slate-500 truncate">{deal.company.name}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">{formatDKK(deal.amount, locale)}</span>
        <div className="flex items-center gap-2">
          {days != null && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${dayBadgeCls}`}
              title={tr("Dage i fase", "Days in stage")}
            >
              {days}d
            </span>
          )}
          {deal.assignedUser?.name && (
            <span
              className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-[9px] font-bold flex items-center justify-center shrink-0"
              title={deal.assignedUser.name}
            >
              {deal.assignedUser.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add deal: search-by-name or pick from saved, no manual CVR typing ─────

interface PickedCompany {
  vat: string;
  name: string;
  city?: string | null;
}

function AddDealButton({
  pipelineId,
  tr,
}: {
  pipelineId: string;
  tr: (da: string, en: string) => string;
}) {
  const createDeal = useCreateDeal(pipelineId);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"search" | "saved">("search");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [picked, setPicked] = useState<PickedCompany | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: suggestions, isFetching: searching } = useSuggestions(debouncedQuery);
  const { data: savedData } = useSavedCompanies();

  function reset() {
    setTab("search");
    setQuery("");
    setDebouncedQuery("");
    setPicked(null);
    setTitle("");
    setAmount("");
  }

  function pick(company: PickedCompany) {
    setPicked(company);
    if (!title.trim()) setTitle(company.name);
  }

  function submit() {
    if (!picked) {
      toast.error(tr("Vælg en virksomhed", "Select a company"));
      return;
    }
    if (!title.trim()) {
      toast.error(tr("Titel kræves", "Title is required"));
      return;
    }
    createDeal.mutate(
      { title: title.trim(), cvr: picked.vat, amount: amount.trim() || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  }

  const savedCompanies = savedData?.results ?? [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer w-full sm:w-auto"
      >
        <span className="material-symbols-outlined text-base">add</span>
        {tr("Ny aftale", "New deal")}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm max-h-[90vh] overflow-y-auto space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">{tr("Ny aftale", "New deal")}</h3>

            {picked ? (
              <div className="flex items-center justify-between gap-2 bg-blue-50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{picked.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    CVR {picked.vat}
                    {picked.city ? ` · ${picked.city}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setPicked(null)}
                  className="shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setTab("search")}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md cursor-pointer ${
                      tab === "search" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                    }`}
                  >
                    {tr("Søg", "Search")}
                  </button>
                  <button
                    onClick={() => setTab("saved")}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md cursor-pointer ${
                      tab === "saved" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                    }`}
                  >
                    {tr("Gemte", "Saved")}
                  </button>
                </div>

                {tab === "search" ? (
                  <div className="space-y-1">
                    <input
                      autoFocus
                      className={inputCls}
                      placeholder={tr("Søg virksomhedsnavn…", "Search company name…")}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                      {searching && (
                        <p className="text-xs text-slate-400 text-center py-3">
                          {tr("Søger…", "Searching…")}
                        </p>
                      )}
                      {!searching && debouncedQuery.length >= 2 && suggestions?.results.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-3">
                          {tr("Ingen resultater", "No results")}
                        </p>
                      )}
                      {suggestions?.results.map((r) => (
                        <button
                          key={r.vat}
                          onClick={() =>
                            pick({ vat: String(r.vat), name: r.life?.name || `CVR ${r.vat}`, city: r.address?.cityname })
                          }
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer"
                        >
                          <p className="text-sm font-medium text-slate-900 truncate">{r.life?.name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            CVR {r.vat}
                            {r.address?.cityname ? ` · ${r.address.cityname}` : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                    {savedCompanies.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-3">
                        {tr("Ingen gemte virksomheder endnu", "No saved companies yet")}
                      </p>
                    )}
                    {savedCompanies.map((s) => {
                      const name =
                        (s.company?.name as string | undefined) ||
                        (s.company?.life as { name?: string } | undefined)?.name ||
                        `CVR ${s.cvr}`;
                      return (
                        <button
                          key={s.id}
                          onClick={() => pick({ vat: s.cvr, name })}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer"
                        >
                          <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
                          <p className="text-xs text-slate-400 truncate">CVR {s.cvr}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <input
              className={inputCls}
              placeholder={tr("Titel", "Title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className={inputCls}
              type="number"
              placeholder={tr("Beløb (DKK)", "Amount (DKK)")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold cursor-pointer"
              >
                {tr("Annuller", "Cancel")}
              </button>
              <button
                onClick={submit}
                disabled={createDeal.isPending}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
              >
                {createDeal.isPending ? tr("Gemmer…", "Saving…") : tr("Opret", "Create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
