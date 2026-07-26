"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Trash2, X, CheckCircle2, Loader2, Play, RefreshCcw, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  INK, HAIR, POS, WARN, NEG,
  ConsoleShell, StatusHeader, RefreshButton, Ledger, LedgerTier, StatCell,
  Panel, Tag, ActionButton, EmptyLine, num, fmtDate,
} from "./console";

interface VideoSlot { id: string; version: number; status: string; title: string; updatedAt: string; videoPath?: string }
interface AdminFeatureRow { key: string; name: string; route: string; da: VideoSlot | null; en: VideoSlot | null }
type UploadStep = "idle" | "signing" | "uploading" | "saving" | "done" | "error";
type UploadTarget = { featureKey: string; locale: "da" | "en"; file?: File };

const inputClass =
  "h-9 w-full rounded-lg border bg-white px-3 font-mono text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400";

function SlotStatus({ status }: { status: string | null }) {
  if (!status) return <Tag color={NEG}>missing</Tag>;
  if (status === "draft") return <Tag color={WARN}>draft</Tag>;
  return <Tag color={POS}>live</Tag>;
}

/* ── One locale slot (DA / EN) within a page ─────────────────────────────── */
function Slot({
  locale, slot, onOpenUpload, onPreview, onPublish, onDelete,
}: {
  locale: "da" | "en";
  slot: VideoSlot | null;
  onOpenUpload: (file?: File) => void;
  onPreview: (url: string, title: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [drag, setDrag] = useState(false);
  const localeName = locale === "da" ? "Danish" : "English";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const videoUrl = slot?.videoPath ? `${supabaseUrl}/storage/v1/object/public/cvr-videos/${slot.videoPath}` : null;

  // ── Empty: a keyboard-accessible drop target ──
  if (!slot) {
    const onDrop = (e: React.DragEvent) => {
      e.preventDefault(); setDrag(false);
      const f = e.dataTransfer.files?.[0];
      if (f && f.type.startsWith("video/")) onOpenUpload(f);
    };
    return (
      <div
        role="button" tabIndex={0}
        onClick={() => onOpenUpload()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenUpload(); } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn("flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-300", drag ? "bg-slate-50" : "hover:bg-slate-50/70")}
        style={{ borderColor: drag ? INK : HAIR }}
      >
        <span className="mb-1 flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{locale}</span>
          <SlotStatus status={null} />
        </span>
        <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Upload size={16} /></div>
        <p className="text-[12.5px] font-semibold" style={{ color: INK }}>Add {localeName} video</p>
        <p className="font-mono text-[10px] text-slate-400">drop a file or click</p>
      </div>
    );
  }

  // ── Filled: thumbnail + actions ──
  return (
    <div className="flex min-h-44 flex-col rounded-xl border p-3" style={{ borderColor: HAIR }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{locale} · {localeName.toLowerCase()}</span>
        <SlotStatus status={slot.status} />
      </div>

      <button
        type="button"
        onClick={() => videoUrl && onPreview(videoUrl, slot.title)}
        className="group relative mb-2.5 aspect-video w-full overflow-hidden rounded-lg bg-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        aria-label={`Preview ${slot.title}`}
      >
        {videoUrl && <video src={`${videoUrl}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm">
            <Play size={15} className="ml-0.5 fill-current" />
          </span>
        </span>
      </button>

      <p className="line-clamp-1 text-[13px] font-semibold" style={{ color: INK }} title={slot.title}>{slot.title}</p>
      <p className="mb-2.5 mt-0.5 font-mono text-[10px] text-slate-400">v{slot.version} · {fmtDate(slot.updatedAt)}</p>

      {confirmDel ? (
        <div className="mt-auto flex items-center gap-1.5">
          <span className="flex-1 font-mono text-[10px] font-bold" style={{ color: NEG }}>Delete this video?</span>
          <ActionButton onClick={() => setConfirmDel(false)}>Cancel</ActionButton>
          <ActionButton tone="danger" onClick={() => onDelete(slot.id)}><Trash2 size={12} /> Delete</ActionButton>
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {slot.status === "draft" && <ActionButton onClick={() => onPublish(slot.id)}><Check size={12} /> Publish</ActionButton>}
          <ActionButton onClick={() => onOpenUpload()}><RefreshCcw size={12} /> Replace</ActionButton>
          <ActionButton tone="danger" onClick={() => setConfirmDel(true)}><Trash2 size={12} /></ActionButton>
        </div>
      )}
    </div>
  );
}

/* ── Upload modal (sign → PUT → save), with drag-and-drop ────────────────── */
function UploadModal({
  target, features, onClose, onSuccess,
}: {
  target: UploadTarget | null;
  features: AdminFeatureRow[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const open = !!target;
  const [step, setStep] = useState<UploadStep>("idle");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const featureKey = target?.featureKey ?? "";
  const locale = target?.locale ?? "da";
  const feature = features.find((f) => f.key === featureKey);

  useEffect(() => {
    if (open) { setStep("idle"); setTitle(""); setFile(target?.file ?? null); setProgress(0); setDrag(false); }
  }, [open, target?.file]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!file || !title.trim()) return;
    setStep("signing");
    try {
      const ext = file.name.split(".").pop();
      const filename = `${featureKey}/${locale}/v${Date.now()}.${ext}`;

      const sigRes = await fetch("/api/admin/videos/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, contentType: file.type }),
      });
      if (!sigRes.ok) throw new Error("Couldn't prepare the upload");
      const { uploadUrl, path } = await sigRes.json();

      setStep("uploading");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setStep("saving");
      const saveRes = await fetch("/api/admin/videos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureKey, locale, title: title.trim(), videoPath: path }),
      });
      if (!saveRes.ok) throw new Error("Couldn't save the video");

      setStep("done");
      toast.success("Video uploaded — it's a draft until you publish it");
      setTimeout(() => { onSuccess(); onClose(); }, 700);
    } catch (err) {
      setStep("error");
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const label: Record<UploadStep, string> = {
    idle: "Upload video", signing: "Preparing…", uploading: `Uploading ${progress}%`,
    saving: "Saving…", done: "Uploaded", error: "Try again",
  };
  const busy = step === "signing" || step === "uploading" || step === "saving";

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("video/")) setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl border p-6 sm:max-w-md" style={{ borderColor: HAIR, background: "#FFFFFF" }}>
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            {locale === "da" ? "Danish" : "English"} · {feature?.name}
          </p>
          <DialogTitle className="text-lg font-black tracking-tight" style={{ color: INK }}>Add a video</DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500">
            It&apos;s saved as a draft. Review it, then publish to show it in the app.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label htmlFor="v-title" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Title</label>
            <input id="v-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dashboard walkthrough" className={inputClass} style={{ borderColor: HAIR }}
              required disabled={busy || step === "done"} />
          </div>

          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Video file</label>
            <div
              onClick={() => !busy && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={busy ? undefined : onDrop}
              className={cn("cursor-pointer rounded-xl border border-dashed p-6 text-center transition-colors", (file || drag) ? "bg-slate-50" : "hover:bg-slate-50/70")}
              style={{ borderColor: file || drag ? INK : HAIR }}
            >
              {file ? (
                <div className="space-y-1">
                  <CheckCircle2 size={20} className="mx-auto" style={{ color: POS }} />
                  <p className="truncate px-2 text-[12.5px] font-semibold" style={{ color: INK }}>{file.name}</p>
                  <p className="font-mono text-[10px] text-slate-400">ready to upload · click to change</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload size={20} className="mx-auto text-slate-400" />
                  <p className="text-[12.5px] font-medium text-slate-600">Drop a video here or click to choose</p>
                  <p className="font-mono text-[10px] text-slate-400">MP4 preferred</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          {step === "uploading" && (
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="uppercase tracking-[0.16em] text-slate-400">uploading</span>
                <span className="font-bold tabular-nums" style={{ color: INK }}>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5 rounded-full bg-slate-100 [&>div]:bg-slate-900" />
            </div>
          )}
        </form>

        <DialogFooter>
          <button type="button" onClick={() => handleSubmit()}
            disabled={!file || !title.trim() || busy}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: step === "done" ? POS : INK }}>
            {busy && <Loader2 size={14} className="animate-spin" />}{label[step]}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Preview modal ───────────────────────────────────────────────────────── */
function PreviewModal({ open, title, videoUrl, onClose }: { open: boolean; title: string; videoUrl: string; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-hidden rounded-2xl border-none bg-slate-950 p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="font-mono text-[11px] text-white/80">{title}</span>
          <button onClick={onClose} className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </div>
        <video src={videoUrl} controls autoPlay className="aspect-video w-full" />
      </DialogContent>
    </Dialog>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */
export function AdminVideosDashboard() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<UploadTarget | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const { data: features = [], isLoading, isFetching, refetch } = useQuery<AdminFeatureRow[]>({
    queryKey: ["admin-videos"],
    queryFn: async () => {
      const res = await fetch("/api/admin/videos");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/videos/${id}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Publish failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-videos"] }); toast.success("Published — it's live in the app"); },
    onError: () => toast.error("Publish failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-videos"] }); toast.success("Video deleted"); },
    onError: () => toast.error("Delete failed"),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      if (!res.ok) throw new Error("Seed failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-videos"] }); toast.success("Default pages added"); },
    onError: () => toast.error("Couldn't add pages"),
  });

  const daLive = features.filter((f) => f.da?.status === "published").length;
  const enLive = features.filter((f) => f.en?.status === "published").length;
  const drafts = features.filter((f) => f.da?.status === "draft" || f.en?.status === "draft").length;
  const totalSlots = features.length * 2;
  const liveSlots = daLive + enLive;

  return (
    <ConsoleShell>
      <StatusHeader
        tone="neutral"
        eyebrow={isLoading ? "video library" : features.length === 0 ? "no pages yet" : `${liveSlots} of ${totalSlots} videos published`}
        title="Onboarding videos"
      >
        <RefreshButton onClick={() => refetch()} isFetching={isFetching} />
      </StatusHeader>

      {isLoading ? (
        <Skeleton className="mb-6 h-28 w-full rounded-xl" />
      ) : (
        <Ledger caption="coverage">
          <LedgerTier cols={4}>
            <StatCell label="Pages" value={num(features.length)} sub="in the app" />
            <StatCell label="Danish live" value={num(daLive)} sub={`of ${features.length}`} />
            <StatCell label="English live" value={num(enLive)} sub={`of ${features.length}`} />
            <StatCell label="Drafts" value={num(drafts)} sub="waiting to publish" />
          </LedgerTier>
        </Ledger>
      )}

      {!isLoading && features.length === 0 ? (
        <Panel title="Pages">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <EmptyLine>No pages yet — there&apos;s nothing to attach a video to.</EmptyLine>
            <ActionButton tone="primary" onClick={() => seedMutation.mutate()} busy={seedMutation.isPending}>
              Add default pages
            </ActionButton>
          </div>
        </Panel>
      ) : (
        <>
          {!isLoading && (
            <p className="mb-4 font-mono text-[11px] text-slate-400">
              Each page shows a Danish and an English clip. Upload a video, then publish it to go live.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)
              : features.map((feature) => {
                  const liveCount = [feature.da, feature.en].filter((s) => s?.status === "published").length;
                  return (
                    <Panel
                      key={feature.key}
                      title={feature.name}
                      right={
                        <span className="font-mono text-[10px] text-slate-400">
                          {feature.route} · <span style={{ color: liveCount === 2 ? POS : undefined }}>{liveCount}/2 live</span>
                        </span>
                      }
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Slot key={feature.da?.id ?? `${feature.key}-da`} locale="da" slot={feature.da}
                          onOpenUpload={(file) => setTarget({ featureKey: feature.key, locale: "da", file })}
                          onPreview={(url, title) => setPreview({ url, title })}
                          onPublish={(id) => publishMutation.mutate(id)}
                          onDelete={(id) => deleteMutation.mutate(id)} />
                        <Slot key={feature.en?.id ?? `${feature.key}-en`} locale="en" slot={feature.en}
                          onOpenUpload={(file) => setTarget({ featureKey: feature.key, locale: "en", file })}
                          onPreview={(url, title) => setPreview({ url, title })}
                          onPublish={(id) => publishMutation.mutate(id)}
                          onDelete={(id) => deleteMutation.mutate(id)} />
                      </div>
                    </Panel>
                  );
                })}
          </div>
        </>
      )}

      <UploadModal
        target={target}
        features={features}
        onClose={() => setTarget(null)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["admin-videos"] })}
      />
      {preview && <PreviewModal open={!!preview} title={preview.title} videoUrl={preview.url} onClose={() => setPreview(null)} />}
    </ConsoleShell>
  );
}
