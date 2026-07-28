"use client";

import { useState } from "react";
import { Check, ShieldQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-context";
import type { PendingConfirm } from "@/lib/hooks/use-search-agent";

export function ConfirmCard({
  pending,
  onDecision,
}: {
  pending: PendingConfirm;
  onDecision: (approved: boolean) => void;
}) {
  const { t } = useLanguage();
  const c = t.agent.confirm;
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);

  const decide = (approved: boolean) => {
    setBusy(approved ? "approve" : "reject");
    onDecision(approved);
  };

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        <ShieldQuestion className="size-4" />
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{c.title}</p>
        <p className="mt-1 text-sm text-foreground">{pending.humanSummary}</p>
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => decide(true)}
            disabled={busy !== null}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="size-4" />
            {c.approve}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => decide(false)}
            disabled={busy !== null}
          >
            <X className="size-4" />
            {c.reject}
          </Button>
        </div>
      </div>
    </div>
  );
}
