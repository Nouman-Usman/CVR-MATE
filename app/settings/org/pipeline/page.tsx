"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  GitBranch,
} from "lucide-react";

// ---- Types ----

interface PipelineStage {
  id: string;
  name: string;
  slug: string;
  color: string;
  isDefault: boolean;
  order: number;
}

// ---- Stage colors ----

const stageColors = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Red", value: "#ef4444" },
  { name: "Yellow", value: "#eab308" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Slate", value: "#64748b" },
];

// ---- Hook ----

function usePipelineStages() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/pipeline");
      if (res.ok) {
        const data = await res.json();
        setStages(data.stages ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  return { stages, setStages, isLoading, refetch: fetchStages };
}

// ---- Page ----

export default function PipelinePage() {
  const { stages, setStages, isLoading, refetch } = usePipelineStages();

  // Create / Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(stageColors[0].value);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  function openCreate() {
    setEditingStage(null);
    setFormName("");
    setFormColor(stageColors[0].value);
    setDialogOpen(true);
  }

  function openEdit(stage: PipelineStage) {
    setEditingStage(stage);
    setFormName(stage.name);
    setFormColor(stage.color);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const isEdit = editingStage !== null;
      const method = isEdit ? "PATCH" : "POST";

      const body = isEdit
        ? { stageId: editingStage.id, name: formName, color: formColor }
        : { name: formName, color: formColor };

      const res = await fetch("/api/admin/pipeline", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(isEdit ? "Stage updated" : "Stage created");
        setDialogOpen(false);
        refetch();
      } else {
        toast.error(isEdit ? "Failed to update stage" : "Failed to create stage");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(stageId: string) {
    try {
      const res = await fetch(`/api/admin/pipeline?stageId=${stageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Stage deleted");
        setDeleteId(null);
        refetch();
      } else {
        toast.error("Failed to delete stage");
      }
    } catch {
      toast.error("Failed to delete stage");
    }
  }

  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  async function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const reordered = [...stages];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);

    // Optimistic update
    const updated = reordered.map((s, i) => ({ ...s, order: i }));
    setStages(updated);

    dragItem.current = null;
    dragOverItem.current = null;

    // Persist order
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reorder: updated.map((s, i) => ({ id: s.id, position: i })),
        }),
      });
      if (res.ok) {
        toast.success("Pipeline order saved");
      } else {
        toast.error("Failed to save order");
        refetch();
      }
    } catch {
      toast.error("Failed to save order");
      refetch();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pipeline Stages</CardTitle>
              <CardDescription>
                Customize the stages in your sales pipeline. Drag to reorder.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" data-icon="inline-start" />
              Add Stage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="size-3 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="ml-auto h-4 w-20" />
                </div>
              ))}
            </div>
          ) : stages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <GitBranch className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">
                No pipeline stages
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add stages to define your sales pipeline.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {stages
                .sort((a, b) => a.order - b.order)
                .map((stage, index) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-sm font-medium">{stage.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {stage.slug}
                    </span>
                    {stage.isDefault && (
                      <Badge variant="outline" className="ml-auto">
                        Default
                      </Badge>
                    )}
                    <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEdit(stage)}
                      >
                        <Pencil className="size-3" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      {!stage.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeleteId(stage.id)}
                        >
                          <Trash2 className="size-3 text-destructive" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingStage ? "Edit Stage" : "Add Stage"}
            </DialogTitle>
            <DialogDescription>
              {editingStage
                ? "Update the stage name and color."
                : "Define a new pipeline stage."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="stage-name">Name</Label>
              <Input
                id="stage-name"
                placeholder="e.g. Qualified, Proposal"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {stageColors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFormColor(c.value)}
                    className="flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c.value }}
                    aria-label={c.name}
                  >
                    {formColor === c.value && (
                      <svg
                        className="size-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
            >
              {saving
                ? "Saving..."
                : editingStage
                  ? "Update Stage"
                  : "Add Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Stage</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this pipeline stage? Companies
              currently in this stage will need to be reassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
