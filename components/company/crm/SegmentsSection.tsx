"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tag, X } from "lucide-react";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import {
  useSegments,
  useCompanySegments,
  useAssignSegment,
  useUnassignSegment,
  useCreateSegment,
} from "@/lib/hooks/use-segments";
import { card, inputCls, panelCls, primaryBtn, SectionHeader } from "./shared";

const SWATCHES = [
  "#94a3b8",
  "#60a5fa",
  "#a78bfa",
  "#fbbf24",
  "#34d399",
  "#f87171",
  "#f472b6",
  "#22d3ee",
];

export function SegmentsSection({ vat }: { vat: string }) {
  const { tr } = useTr();
  const apiError = useApiErrorMessage();
  const { data: assignedData } = useCompanySegments(vat);
  const { data: allData } = useSegments();
  const assign = useAssignSegment(vat);
  const unassign = useUnassignSegment(vat);
  const createSegment = useCreateSegment();
  const [showPicker, setShowPicker] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SWATCHES[0]);

  const assigned = assignedData?.segments ?? [];
  const assignedIds = new Set(assigned.map((s) => s.id));
  const available = (allData?.segments ?? []).filter((s) => !assignedIds.has(s.id));

  function createAndAssign() {
    const name = newName.trim();
    if (!name) return;
    createSegment.mutate(
      { name, color: newColor },
      {
        onSuccess: (res) => {
          const id = res?.segment?.id as string | undefined;
          if (id) assign.mutate(id);
          setNewName("");
        },
        onError: (e) => toast.error(apiError(e)),
      }
    );
  }

  return (
    <div className={card}>
      <SectionHeader
        icon={Tag}
        title={tr("Segmenter", "Segments")}
        action={
          <button onClick={() => setShowPicker((s) => !s)} className={primaryBtn}>
            {showPicker ? tr("Luk", "Close") : tr("Administrér", "Manage")}
          </button>
        }
      />

      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {tr("Ingen segmenter tildelt.", "No segments assigned.")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assigned.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 py-1 pl-2.5 pr-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: s.color }}
            >
              {s.name}
              <button
                onClick={() => unassign.mutate(s.id)}
                className="hover:bg-white/20 rounded-full p-0.5 cursor-pointer"
                aria-label={tr("Fjern", "Remove")}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {showPicker && (
        <div className={"mt-4 space-y-3 " + panelCls}>
          {available.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                {tr("Tildel eksisterende", "Assign existing")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {available.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => assign.mutate(s.id)}
                    className="inline-flex items-center gap-1.5 py-1 px-2 rounded-full text-xs font-medium text-foreground border border-border hover:bg-background cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
              {tr("Opret nyt segment", "Create new segment")}
            </p>
            <div className="flex items-center gap-2">
              <input
                className={inputCls}
                placeholder={tr("Navn", "Name")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                onClick={createAndAssign}
                disabled={createSegment.isPending || !newName.trim()}
                className={primaryBtn + " py-2 shrink-0"}
              >
                {tr("Opret", "Create")}
              </button>
            </div>
            <div className="flex gap-1.5 mt-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={
                    "w-5 h-5 rounded-full cursor-pointer " +
                    (newColor === c ? "ring-2 ring-offset-1 ring-ring ring-offset-background" : "")
                  }
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
