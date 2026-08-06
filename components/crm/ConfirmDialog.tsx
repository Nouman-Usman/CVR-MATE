"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTr } from "@/lib/i18n/tr";

/**
 * Confirmation for destructive actions.
 *
 * The CRM shipped with five one-click permanent deletes (quote, product,
 * segment, interaction, contract) in four inconsistent styles — one used the
 * native `window.confirm`, two destroyed silently on click. This is the single
 * pattern for all of them.
 *
 * `name` matters: "Delete quote Q-00042 for Novo Nordisk?" is a real guard,
 * while "Are you sure?" is a speed bump people click through.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  name,
  confirmLabel,
  onConfirm,
  isPending = false,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  name?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  destructive?: boolean;
}) {
  const { tr } = useTr();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {destructive && (
              <div className="size-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
            )}
            <div className="space-y-1.5 text-left">
              <DialogTitle>{title}</DialogTitle>
              {(description || name) && (
                <DialogDescription>
                  {name && <span className="font-medium text-foreground">{name}</span>}
                  {name && description ? " — " : ""}
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {tr("Annullér", "Cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className="rounded-xl gap-1.5"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {confirmLabel ?? tr("Slet", "Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook form of the same thing, for list rows where wiring per-row open state by
 * hand would mean one `useState` per row.
 *
 * ```tsx
 * const confirm = useConfirm();
 * <button onClick={() => confirm.ask({ title, name, onConfirm: () => del.mutate(id) })} />
 * {confirm.dialog}
 * ```
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    name?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", onConfirm: () => {} });

  function ask(opts: {
    title: string;
    description?: string;
    name?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }) {
    setState({ ...opts, open: true });
  }

  const dialog: ReactNode = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      title={state.title}
      description={state.description}
      name={state.name}
      confirmLabel={state.confirmLabel}
      onConfirm={() => {
        state.onConfirm();
        setState((s) => ({ ...s, open: false }));
      }}
    />
  );

  return { ask, dialog };
}
