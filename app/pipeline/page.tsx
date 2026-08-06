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
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  ExternalLink,
  Building2,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSubscription } from "@/lib/hooks/use-subscription";
import { formatOre, daysSince } from "@/lib/format";
import { parseKronerToOre, oreToInputString } from "@/lib/money/parse";
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
  useDeal,
  useUpdateDeal,
  useDeleteDeal,
  type BoardColumn,
  type BoardDeal,
  type PipelineSummary,
  type DealDetail,
} from "@/lib/hooks/use-pipeline";
import { useSession } from "@/lib/auth-client";
import { useOrganization } from "@/lib/hooks/use-team";
import { useContacts } from "@/lib/hooks/use-contacts";

const NONE = "__none__";

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
  const [openDealId, setOpenDealId] = useState<string | null>(null);

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
        <div className="flex flex-col gap-4 mb-5 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
              {tr("Pipeline", "Pipeline")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
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
          <CenteredLoader />
        ) : !hasCrm ? (
          <UpgradeNotice tr={tr} />
        ) : pipelinesError ? (
          <ErrorNotice message={(pipelinesErrorObj as Error)?.message} tr={tr} />
        ) : isLoading || !board ? (
          <CenteredLoader />
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none -mx-3 px-3 sm:mx-0 sm:px-0">
              {board.columns.map((col) => (
                <Column
                  key={col.stage.id}
                  column={col}
                  locale={locale}
                  tr={tr}
                  onOpenDeal={setOpenDealId}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>
      {openDealId && activePipelineId && (
        <DealDetailPanel
          dealId={openDealId}
          pipelineId={activePipelineId}
          locale={locale}
          tr={tr}
          onClose={() => setOpenDealId(null)}
        />
      )}
    </DashboardLayout>
  );
}

function CenteredLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function UpgradeNotice({ tr }: { tr: (da: string, en: string) => string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-6 text-primary" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-foreground font-[family-name:var(--font-manrope)]">
        {tr("CRM kræver Enterprise", "CRM requires Enterprise")}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
        {tr(
          "Den indbyggede CRM og pipeline er tilgængelig på Enterprise-planen.",
          "The built-in CRM and pipeline are available on the Enterprise plan."
        )}
      </p>
      <Button variant="gradient" size="lg" className="mt-5" render={<a href="/settings" />}>
        {tr("Opgradér", "Upgrade")}
      </Button>
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
    <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10">
        <AlertCircle className="size-6 text-amber-600" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-foreground font-[family-name:var(--font-manrope)]">
        {tr("Kunne ikke indlæse pipeline", "Couldn't load pipeline")}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
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
    <div className="flex items-center gap-1.5">
      <Select
        items={pipelines.map((p) => ({
          value: p.id,
          label: `${p.name}${p.isDefault ? tr(" (standard)", " (default)") : ""}`,
        }))}
        value={activeId}
        onValueChange={(v) => onSelect(v)}
      >
        <SelectTrigger className="min-w-[10rem] flex-1 sm:flex-initial bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pipelines.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
              {p.isDefault ? tr(" (standard)", " (default)") : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={openRename}
        disabled={!activeId || busy}
        title={tr("Omdøb pipeline", "Rename pipeline")}
      >
        <Pencil />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={openCreate}
        disabled={busy}
        title={tr("Ny pipeline", "New pipeline")}
      >
        <Plus />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleDelete}
        disabled={!activeId || busy || activePipeline?.isDefault}
        title={tr("Slet pipeline", "Delete pipeline")}
        className="hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 />
      </Button>

      <Dialog open={mode !== "idle"} onOpenChange={(open) => !open && setMode("idle")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "create"
                ? tr("Ny pipeline", "New pipeline")
                : tr("Omdøb pipeline", "Rename pipeline")}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={tr("Navn", "Name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode("idle")}>
              {tr("Annuller", "Cancel")}
            </Button>
            <Button variant="gradient" onClick={submit} disabled={busy || !name.trim()}>
              {busy ? tr("Gemmer…", "Saving…") : tr("Gem", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({
  column,
  locale,
  tr,
  onOpenDeal,
}: {
  column: BoardColumn;
  locale: string;
  tr: (da: string, en: string) => string;
  onOpenDeal: (dealId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });
  const total = column.deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  return (
    <div className="w-[82vw] max-w-[300px] sm:w-72 shrink-0 snap-start">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: column.stage.color ?? "#94a3b8" }}
          />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground truncate">
            {column.stage.name}
          </h3>
          <Badge variant="outline" className="shrink-0 text-[10px] h-4.5">
            {column.deals.length}
          </Badge>
        </div>
        <span className="text-[11px] font-mono tabular-nums font-semibold text-muted-foreground shrink-0">
          {formatOre(total, locale)}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] rounded-xl p-2 space-y-2 transition-colors border",
          isOver ? "bg-primary/5 border-primary/30" : "bg-muted/40 border-transparent"
        )}
      >
        {column.deals.map((d) => (
          <DealCard key={d.id} deal={d} locale={locale} tr={tr} onOpen={() => onOpenDeal(d.id)} />
        ))}
        {column.deals.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center py-6">{tr("Tom", "Empty")}</p>
        )}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  locale,
  tr,
  onOpen,
}: {
  deal: BoardDeal;
  locale: string;
  tr: (da: string, en: string) => string;
  onOpen: () => void;
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

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.5 : 1 }}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={cn(
        "bg-card rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing touch-none hover:shadow-md hover:border-foreground/15 transition-all",
        staleness === "red" ? "border-destructive/30" : "border-border"
      )}
    >
      <p className="text-sm font-semibold text-foreground truncate">{deal.title}</p>
      {deal.company && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground truncate">
          <Building2 className="size-3 shrink-0" />
          {deal.company.name}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs font-mono tabular-nums font-bold text-foreground">
          {formatOre(deal.amount, locale)}
        </span>
        <div className="flex items-center gap-1.5">
          {days != null && (
            <Badge
              variant={staleness === "red" ? "destructive" : staleness === "amber" ? "secondary" : "outline"}
              className={cn(
                "text-[10px] h-4.5",
                staleness === "amber" && "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
              )}
              title={tr("Dage i fase", "Days in stage")}
            >
              {days}d
            </Badge>
          )}
          {deal.assignedUser?.name && (
            <Avatar className="size-5" title={deal.assignedUser.name}>
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-[9px] font-bold">
                {deal.assignedUser.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
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

  // Deal amounts are stored in øre; the field accepts kroner as typed
  // ("1.234,56"), so an unreadable value must block the save rather than
  // silently becoming 0.
  const parsedAmount = amount.trim() ? parseKronerToOre(amount) : null;

  function submit() {
    if (!picked) {
      toast.error(tr("Vælg en virksomhed", "Select a company"));
      return;
    }
    if (!title.trim()) {
      toast.error(tr("Titel kræves", "Title is required"));
      return;
    }
    if (amount.trim() && parsedAmount === null) {
      toast.error(tr("Ugyldigt beløb", "Invalid amount"));
      return;
    }
    createDeal.mutate(
      { title: title.trim(), cvr: picked.vat, amount: parsedAmount ?? undefined },
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
      <Button variant="gradient" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Plus />
        {tr("Ny aftale", "New deal")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Ny aftale", "New deal")}</DialogTitle>
        </DialogHeader>

        {picked ? (
          <div className="flex items-center justify-between gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{picked.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                CVR {picked.vat}
                {picked.city ? ` · ${picked.city}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setPicked(null)}>
              <X />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={tab === "search" ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 shadow-none"
                onClick={() => setTab("search")}
              >
                {tr("Søg", "Search")}
              </Button>
              <Button
                variant={tab === "saved" ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 shadow-none"
                onClick={() => setTab("saved")}
              >
                {tr("Gemte", "Saved")}
              </Button>
            </div>

            {tab === "search" ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-8"
                    placeholder={tr("Søg virksomhedsnavn…", "Search company name…")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {searching && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      {tr("Søger…", "Searching…")}
                    </p>
                  )}
                  {!searching && debouncedQuery.length >= 2 && suggestions?.results.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      {tr("Ingen resultater", "No results")}
                    </p>
                  )}
                  {suggestions?.results.map((r) => (
                    <button
                      key={r.vat}
                      onClick={() =>
                        pick({ vat: String(r.vat), name: r.life?.name || `CVR ${r.vat}`, city: r.address?.cityname })
                      }
                      className="w-full text-left px-3 py-2 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground truncate">{r.life?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        CVR {r.vat}
                        {r.address?.cityname ? ` · ${r.address.cityname}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {savedCompanies.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
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
                      className="w-full text-left px-3 py-2 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">CVR {s.cvr}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="space-y-1.5">
          <Label>{tr("Titel", "Title")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Beløb (DKK)", "Amount (DKK)")}</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            {tr("Annuller", "Cancel")}
          </Button>
          <Button variant="gradient" onClick={submit} disabled={createDeal.isPending}>
            {createDeal.isPending ? tr("Gemmer…", "Saving…") : tr("Opret", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Deal detail panel: expanded view for a single deal ────────────────────

function DealDetailPanel({
  dealId,
  pipelineId,
  locale,
  tr,
  onClose,
}: {
  dealId: string;
  pipelineId: string;
  locale: string;
  tr: (da: string, en: string) => string;
  onClose: () => void;
}) {
  const { data: dealData, isLoading } = useDeal(dealId);
  const deal = dealData?.deal;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-5 gap-4">
        <SheetHeader className="p-0">
          <SheetTitle className="font-[family-name:var(--font-manrope)]">
            {tr("Aftaledetaljer", "Deal details")}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !deal ? (
          <CenteredLoader />
        ) : (
          <DealForm
            key={deal.id}
            deal={deal}
            pipelineId={pipelineId}
            locale={locale}
            tr={tr}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DealForm({
  deal,
  pipelineId,
  locale,
  tr,
  onClose,
}: {
  deal: DealDetail;
  pipelineId: string;
  locale: string;
  tr: (da: string, en: string) => string;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const { data: orgData } = useOrganization(session?.user?.id);
  const { data: contactsData } = useContacts(deal.company?.vat ?? "");
  const updateDeal = useUpdateDeal(pipelineId);
  const deleteDeal = useDeleteDeal(pipelineId);

  // Initialized once from `deal` at mount — this component is remounted via
  // `key={deal.id}` whenever a different deal opens, so no sync effect needed.
  const [title, setTitle] = useState(deal.title);
  const [amount, setAmount] = useState(
    deal.amount != null ? oreToInputString(deal.amount, locale === "da" ? "da" : "en") : ""
  );
  const [closeDate, setCloseDate] = useState(deal.closeDate ?? "");
  const [assignedUserId, setAssignedUserId] = useState(deal.assignedUser?.id ?? "");
  const [primaryContactId, setPrimaryContactId] = useState(deal.primaryContact?.id ?? "");
  const [lostReason, setLostReason] = useState(deal.lostReason ?? "");

  const parsedAmount = amount.trim() ? parseKronerToOre(amount) : null;

  function save() {
    if (!title.trim()) {
      toast.error(tr("Titel kræves", "Title is required"));
      return;
    }
    if (amount.trim() && parsedAmount === null) {
      toast.error(tr("Ugyldigt beløb", "Invalid amount"));
      return;
    }
    updateDeal.mutate(
      {
        id: deal.id,
        title: title.trim(),
        amount: amount.trim() ? parsedAmount : null,
        // closeDate/lostReason only accept a value or absence (undefined) server-side,
        // not an explicit null — the empty string is preprocessed to undefined there.
        closeDate,
        assignedUserId: assignedUserId || null,
        primaryContactId: primaryContactId || null,
        lostReason,
      },
      {
        onSuccess: () => toast.success(tr("Gemt", "Saved")),
        onError: (err) => toast.error((err as Error).message),
      }
    );
  }

  function remove() {
    if (!window.confirm(tr(`Slet aftalen "${deal.title}"?`, `Delete deal "${deal.title}"?`))) return;
    deleteDeal.mutate(deal.id, {
      onSuccess: () => {
        toast.success(tr("Aftale slettet", "Deal deleted"));
        onClose();
      },
      onError: (err) => toast.error((err as Error).message),
    });
  }

  const days = daysSince(deal.stageChangedAt);
  const busy = updateDeal.isPending || deleteDeal.isPending;

  return (
    <div className="flex flex-col gap-4">
      {deal.company && (
        <div className="bg-muted/50 rounded-lg px-3 py-2.5 border border-border">
          <p className="text-sm font-semibold text-foreground truncate">{deal.company.name}</p>
          <a
            href={`/company/${deal.company.vat}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            CVR {deal.company.vat} · {tr("Se virksomhed", "View company")}
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: deal.stage?.color ?? "#94a3b8" }}
          />
          {deal.stage?.name}
        </Badge>
        {deal.status === "won" && (
          <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-transparent">
            {tr("Vundet", "Won")}
          </Badge>
        )}
        {deal.status === "lost" && (
          <Badge variant="destructive">{tr("Tabt", "Lost")}</Badge>
        )}
        {days != null && (
          <span className="text-xs text-muted-foreground">
            {days}d {tr("i denne fase", "in this stage")}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{tr("Titel", "Title")}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>{tr("Beløb (DKK)", "Amount (DKK)")}</Label>
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>{tr("Lukkedato", "Close date")}</Label>
        <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>{tr("Ansvarlig", "Assigned to")}</Label>
        <Select
          items={[
            { value: NONE, label: tr("Ingen", "Unassigned") },
            ...(orgData?.org?.members?.map((m) => ({ value: m.userId, label: m.user.name })) ?? []),
          ]}
          value={assignedUserId || NONE}
          onValueChange={(v) => setAssignedUserId(v && v !== NONE ? v : "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{tr("Ingen", "Unassigned")}</SelectItem>
            {orgData?.org?.members?.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{tr("Primær kontakt", "Primary contact")}</Label>
        <Select
          items={[
            { value: NONE, label: tr("Ingen", "None") },
            ...(contactsData?.contacts.map((c) => ({ value: c.id, label: c.name })) ?? []),
          ]}
          value={primaryContactId || NONE}
          onValueChange={(v) => setPrimaryContactId(v && v !== NONE ? v : "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{tr("Ingen", "None")}</SelectItem>
            {contactsData?.contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {deal.status === "lost" && (
        <div className="space-y-1.5">
          <Label>{tr("Årsag til tab", "Lost reason")}</Label>
          <Textarea
            className="min-h-[70px] resize-none"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        {tr("Oprettet", "Created")} {new Date(deal.createdAt).toLocaleDateString(locale)}
      </p>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
        <Button variant="destructive" onClick={remove} disabled={busy} className="mt-4">
          <Trash2 />
          {tr("Slet", "Delete")}
        </Button>
        <Button variant="gradient" onClick={save} disabled={busy} className="mt-4">
          {updateDeal.isPending ? tr("Gemmer…", "Saving…") : tr("Gem", "Save")}
        </Button>
      </div>
    </div>
  );
}
