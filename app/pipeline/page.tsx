"use client";

import { useState } from "react";
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
import {
  usePipelines,
  useBoard,
  useMoveDeal,
  useCreateDeal,
  type BoardColumn,
  type BoardDeal,
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
      <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{tr("Pipeline", "Pipeline")}</h1>
            <p className="text-sm text-slate-500">
              {tr("Administrér dine salgsaftaler", "Manage your sales deals")}
            </p>
          </div>
          {hasCrm && pipelines.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white"
                value={activePipelineId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isDefault ? tr(" (standard)", " (default)") : ""}
                  </option>
                ))}
              </select>
              {activePipelineId && <AddDealButton pipelineId={activePipelineId} tr={tr} />}
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
            <div className="flex gap-4 overflow-x-auto pb-4">
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
    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
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
    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
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
    <div className="w-72 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: column.stage.color ?? "#94a3b8" }}
          />
          <h3 className="text-sm font-semibold text-slate-700">{column.stage.name}</h3>
          <span className="text-xs text-slate-400">{column.deals.length}</span>
        </div>
        <span className="text-[11px] font-medium text-slate-400">{formatDKK(total, locale)}</span>
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

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.5 : 1 }}
      {...listeners}
      {...attributes}
      className="bg-white rounded-lg border border-slate-100 shadow-sm p-3 cursor-grab active:cursor-grabbing"
    >
      <p className="text-sm font-semibold text-slate-900 truncate">{deal.title}</p>
      {deal.company && (
        <p className="text-xs text-slate-500 truncate">{deal.company.name}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">{formatDKK(deal.amount, locale)}</span>
        <div className="flex items-center gap-2">
          {days != null && (
            <span className="text-[10px] text-slate-400" title={tr("Dage i fase", "Days in stage")}>
              {days}d
            </span>
          )}
          {deal.assignedUser?.name && (
            <span
              className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-[9px] font-bold flex items-center justify-center"
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

function AddDealButton({
  pipelineId,
  tr,
}: {
  pipelineId: string;
  tr: (da: string, en: string) => string;
}) {
  const createDeal = useCreateDeal(pipelineId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [cvr, setCvr] = useState("");
  const [amount, setAmount] = useState("");

  function submit() {
    if (!title.trim() || !/^\d{8}$/.test(cvr.trim())) {
      toast.error(tr("Titel og gyldigt CVR (8 cifre) kræves", "Title and valid CVR (8 digits) required"));
      return;
    }
    createDeal.mutate(
      { title: title.trim(), cvr: cvr.trim(), amount: amount.trim() || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setCvr("");
          setAmount("");
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer"
      >
        <span className="material-symbols-outlined text-base">add</span>
        {tr("Ny aftale", "New deal")}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">{tr("Ny aftale", "New deal")}</h3>
            <input
              className={inputCls}
              placeholder={tr("Titel", "Title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder={tr("CVR (8 cifre)", "CVR (8 digits)")}
              value={cvr}
              onChange={(e) => setCvr(e.target.value)}
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
                onClick={() => setOpen(false)}
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
