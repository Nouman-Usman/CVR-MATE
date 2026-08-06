"use client";

import { useState } from "react";
import { SlidersHorizontal, Check, RotateCcw, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  METRICS,
  METRICS_BY_ID,
  MAX_SELECTED,
  MIN_SELECTED,
  type MetricDef,
} from "@/lib/dashboard/metrics";

/**
 * Lets the user choose which metrics appear as cards.
 *
 * Edits are held in local draft state and only committed on save, so closing
 * the dialog with Escape or the backdrop discards rather than silently
 * rewriting the dashboard behind them.
 *
 * Selection *order* is preserved: the card grid renders in the order chosen, so
 * picking is also ranking, without a separate drag-and-drop affordance.
 */
export function MetricPicker({
  selected,
  onSave,
  onReset,
  /** Ids with no data on this account — org metrics for a user with no org. */
  unavailable,
  locale,
}: {
  selected: string[];
  onSave: (ids: string[]) => void;
  onReset: () => void;
  unavailable: Set<string>;
  locale: string;
}) {
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);

  function openChange(next: boolean) {
    // Re-seed from the committed value each time it opens, so a discarded edit
    // does not linger into the next visit.
    if (next) setDraft(selected);
    setOpen(next);
  }

  function toggle(id: string) {
    setDraft((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_SELECTED
          ? prev
          : [...prev, id]
    );
  }

  const groups = METRICS.reduce<Map<string, MetricDef[]>>((acc, m) => {
    const key = locale === "da" ? m.group[0] : m.group[1];
    const list = acc.get(key) ?? [];
    list.push(m);
    acc.set(key, list);
    return acc;
  }, new Map());

  const tooFew = draft.length < MIN_SELECTED;
  const atCap = draft.length >= MAX_SELECTED;

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="rounded-xl gap-2 shrink-0" />
        }
      >
        <SlidersHorizontal className="size-3.5" />
        <span className="hidden sm:inline">{tr("Tilpas", "Customise")}</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{tr("Vælg dine nøgletal", "Choose your metrics")}</DialogTitle>
          <DialogDescription>
            {tr(
              `Vælg mellem ${MIN_SELECTED} og ${MAX_SELECTED} kort. Rækkefølgen følger dine valg.`,
              `Pick between ${MIN_SELECTED} and ${MAX_SELECTED} cards. They appear in the order you select them.`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5">
          {[...groups.entries()].map(([groupLabel, metrics]) => (
            <div key={groupLabel}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                {groupLabel}
              </p>
              <div className="space-y-1.5">
                {metrics.map((m) => {
                  const isOn = draft.includes(m.id);
                  const missing = unavailable.has(m.id);
                  const blocked = !isOn && (atCap || missing);
                  const Icon = m.icon;
                  const order = draft.indexOf(m.id) + 1;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => !missing && toggle(m.id)}
                      disabled={blocked}
                      aria-pressed={isOn}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                        isOn
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:bg-muted/60",
                        blocked && "opacity-40 cursor-not-allowed hover:bg-transparent",
                        !blocked && "cursor-pointer"
                      )}
                    >
                      <span
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center shrink-0",
                          m.accent
                        )}
                      >
                        <Icon className="size-4" />
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground truncate">
                          {locale === "da" ? m.label[0] : m.label[1]}
                        </span>
                        {missing && (
                          <span className="block text-[11px] text-muted-foreground">
                            {tr(
                              "Kræver en organisation",
                              "Requires an organisation"
                            )}
                          </span>
                        )}
                      </span>

                      {missing ? (
                        <Lock className="size-3.5 text-muted-foreground shrink-0" />
                      ) : isOn ? (
                        // The position number makes it obvious that selection
                        // order is what orders the grid.
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                            {order}
                          </span>
                          <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="size-3" />
                          </span>
                        </span>
                      ) : (
                        <span className="size-5 rounded-full border border-border shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              <RotateCcw className="size-3.5" />
              {tr("Nulstil", "Reset")}
            </Button>
            <span
              className={cn(
                "text-xs tabular-nums",
                tooFew ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {draft.length}/{MAX_SELECTED}
            </span>
          </div>

          <Button
            size="sm"
            className="rounded-xl"
            disabled={tooFew}
            onClick={() => {
              onSave(draft.filter((id) => METRICS_BY_ID.has(id)));
              setOpen(false);
            }}
          >
            {tr("Gem", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
