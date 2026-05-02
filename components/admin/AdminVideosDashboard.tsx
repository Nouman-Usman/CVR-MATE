"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Eye, Play, Trash2, Zap, CheckCircle2, AlertCircle,
  X, CloudUpload, Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────────
interface VideoSlot {
  id: string;
  version: number;
  status: string;
  title: string;
  updatedAt: string;
  videoPath?: string;
}

interface AdminFeatureRow {
  key: string;
  name: string;
  route: string;
  da: VideoSlot | null;
  en: VideoSlot | null;
}

type UploadStep = "idle" | "signing" | "uploading" | "saving" | "done" | "error";
type ToastState = { message: string; type: "success" | "error" } | null;

// ── Status badge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px] font-semibold hover:bg-red-50">Missing</Badge>;
  if (status === "draft") return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold hover:bg-amber-50">Draft</Badge>;
  return <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] font-semibold hover:bg-green-50">Published</Badge>;
}

// ── Toast ───────────────────────────────────────────────────────────────────────
function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div className={cn(
      "fixed bottom-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium",
      toast.type === "success"
        ? "bg-green-50 border-green-200 text-green-800"
        : "bg-red-50 border-red-200 text-red-800"
    )}>
      {toast.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {toast.message}
    </div>
  );
}

// ── Upload modal ────────────────────────────────────────────────────────────────
function UploadModal({
  open, featureKey, locale, features,
  onClose, onSuccess,
}: {
  open: boolean;
  featureKey: string;
  locale: "da" | "en";
  features: AdminFeatureRow[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<UploadStep>("idle");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setStep("idle"); setTitle(""); setFile(null); setProgress(0); setError(""); }
  }, [open]);

  if (!open) return null;

  const feature = features.find((f) => f.key === featureKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError(""); setStep("signing");

    try {
      const ext = file.name.split(".").pop();
      const filename = `${featureKey}/${locale}/v${Date.now()}.${ext}`;

      setStep("signing");
      const sigRes = await fetch("/api/admin/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, contentType: file.type }),
      });
      if (!sigRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, path } = await sigRes.json();

      setStep("uploading");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setStep("saving");
      const saveRes = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureKey, locale, title: title.trim(), videoPath: path }),
      });
      if (!saveRes.ok) throw new Error("Failed to save video record");

      setStep("done");
      setTimeout(() => { onSuccess(); onClose(); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("error");
    }
  };

  const stepLabel: Record<UploadStep, string> = {
    idle: "Upload Video",
    signing: "Preparing…",
    uploading: `Uploading… ${progress}%`,
    saving: "Saving…",
    done: "Done!",
    error: "Upload failed",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-[#e2e8f0]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f5f9]">
          <div>
            <h2 className="font-semibold text-[#191c1e] text-base">Upload Video</h2>
            <p className="text-xs text-[#64748b] mt-0.5">
              {feature?.name} · <span className="uppercase font-semibold">{locale}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#191c1e] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Locale tabs */}
          <div>
            <Label className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2 block">Locale</Label>
            <div className="flex gap-2">
              {(["da", "en"] as const).map((l) => (
                <div
                  key={l}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium cursor-default select-none",
                    l === locale ? "bg-[#eff6ff] border-[#2563eb] text-[#2563eb]" : "border-[#e2e8f0] text-[#64748b]"
                  )}
                >
                  <Globe size={13} />
                  {l.toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="vtitle" className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2 block">
              Video Title
            </Label>
            <Input
              id="vtitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Company Search Tutorial"
              disabled={step !== "idle" && step !== "error"}
              className="border-[#e2e8f0] text-sm"
              required
            />
          </div>

          {/* File drop */}
          <div>
            <Label className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2 block">
              Video File
            </Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                file ? "border-[#2563eb] bg-[#eff6ff]" : "border-[#e2e8f0] hover:border-[#2563eb] hover:bg-[#f8fafc]"
              )}
              onClick={() => fileRef.current?.click()}
            >
              <CloudUpload size={28} className={cn("mx-auto mb-2", file ? "text-[#2563eb]" : "text-[#94a3b8]")} />
              {file ? (
                <p className="text-sm font-medium text-[#2563eb]">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#64748b]">Drag & drop or click to browse</p>
                  <p className="text-xs text-[#94a3b8] mt-1">MP4, WebM, MOV supported</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={step !== "idle" && step !== "error"}
              />
            </div>
          </div>

          {/* Progress */}
          {step === "uploading" && (
            <div>
              <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                <div className="h-full bg-[#2563eb] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-[#64748b] mt-1.5 text-center">{progress}%</p>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

          <Button
            type="submit"
            disabled={!file || !title.trim() || (step !== "idle" && step !== "error")}
            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          >
            {step === "done" ? "✓ Uploaded!" : stepLabel[step]}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Preview modal ───────────────────────────────────────────────────────────────
function PreviewModal({
  open, title, videoUrl,
  onClose,
}: { open: boolean; title: string; videoUrl: string; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-[#e2e8f0] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <h2 className="font-semibold text-[#191c1e] text-sm">{title}</h2>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#191c1e]"><X size={18} /></button>
        </div>
        <div className="bg-black">
          <video src={videoUrl} controls autoPlay className="w-full max-h-[400px]" />
        </div>
      </div>
    </div>
  );
}

// ── Locale slot ─────────────────────────────────────────────────────────────────
function LocaleSlot({
  locale, slot, featureKey,
  onUpload, onPreview,
  onPublish, onDelete,
}: {
  locale: "da" | "en";
  slot: VideoSlot | null;
  featureKey: string;
  onUpload: () => void;
  onPreview: (url: string, title: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const videoUrl = slot?.videoPath ? `${supabaseUrl}/storage/v1/object/public/cvr-videos/${slot.videoPath}` : null;

  return (
    <div className="flex-1 min-w-0 rounded-lg border border-[#e2e8f0] p-3 bg-[#f8fafc]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">{locale}</span>
        <StatusBadge status={slot?.status ?? null} />
      </div>

      {slot ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#191c1e] truncate" title={slot.title}>{slot.title}</p>
          <p className="text-[10px] text-[#94a3b8]">v{slot.version}</p>
          <div className="flex gap-1.5 flex-wrap">
            {videoUrl && (
              <button
                onClick={() => onPreview(videoUrl, slot.title)}
                className="flex items-center gap-1 text-[10px] text-[#64748b] hover:text-[#2563eb] transition-colors px-2 py-1 rounded border border-[#e2e8f0] bg-white hover:border-[#2563eb]"
              >
                <Eye size={11} /> Preview
              </button>
            )}
            {slot.status === "draft" && (
              <button
                onClick={() => onPublish(slot.id)}
                className="flex items-center gap-1 text-[10px] text-[#2563eb] hover:bg-[#eff6ff] px-2 py-1 rounded border border-[#2563eb] bg-white transition-colors"
              >
                <Play size={11} /> Publish
              </button>
            )}
            {confirmDelete ? (
              <div className="flex gap-1">
                <button onClick={() => onDelete(slot.id)} className="text-[10px] text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-red-200 bg-white">Confirm</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-[#64748b] px-2 py-1 rounded border border-[#e2e8f0] bg-white">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-[10px] text-[#64748b] hover:text-red-600 hover:border-red-200 px-2 py-1 rounded border border-[#e2e8f0] bg-white transition-colors"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={onUpload}
          className="flex items-center gap-1.5 text-xs text-[#2563eb] font-medium mt-1 hover:underline"
        >
          <Upload size={12} /> Upload {locale.toUpperCase()}
        </button>
      )}
    </div>
  );
}

// ── Main dashboard ──────────────────────────────────────────────────────────────
export function AdminVideosDashboard() {
  const queryClient = useQueryClient();
  const [upload, setUpload] = useState<{ featureKey: string; locale: "da" | "en" } | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: features = [], isLoading } = useQuery<AdminFeatureRow[]>({
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-videos"] }); showToast("Video published", "success"); },
    onError: () => showToast("Publish failed", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-videos"] }); showToast("Video deleted", "success"); },
    onError: () => showToast("Delete failed", "error"),
  });

  const daCoverage = features.filter((f) => f.da?.status === "published").length;
  const enCoverage = features.filter((f) => f.en?.status === "published").length;
  const drafts = features.filter((f) => f.da?.status === "draft" || f.en?.status === "draft").length;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <Toast toast={toast} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#191c1e]">Feature Videos</h1>
        <p className="text-sm text-[#64748b] mt-1">Contextual tutorials shown to users · owner only</p>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-8 flex-wrap">
        {[
          { label: "DA Coverage", value: `${daCoverage}/${features.length}`, color: daCoverage === features.length ? "text-green-700 bg-green-50 border-green-200" : "text-amber-700 bg-amber-50 border-amber-200" },
          { label: "EN Coverage", value: `${enCoverage}/${features.length}`, color: enCoverage === features.length ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200" },
          { label: "Drafts Pending", value: String(drafts), color: drafts > 0 ? "text-blue-700 bg-blue-50 border-blue-200" : "text-[#64748b] bg-[#f8fafc] border-[#e2e8f0]" },
        ].map(({ label, value, color }) => (
          <div key={label} className={cn("flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium", color)}>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
            <span className="text-lg font-bold">{isLoading ? "—" : value}</span>
          </div>
        ))}
      </div>

      {/* Feature cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-[#e2e8f0] shadow-sm animate-pulse">
                <CardContent className="p-5">
                  <div className="h-5 bg-[#f1f5f9] rounded w-40 mb-2" />
                  <div className="h-3 bg-[#f1f5f9] rounded w-24 mb-4" />
                  <div className="flex gap-3">
                    <div className="flex-1 h-24 bg-[#f1f5f9] rounded-lg" />
                    <div className="flex-1 h-24 bg-[#f1f5f9] rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))
          : features.map((feature) => (
              <Card key={feature.key} className="border-[#e2e8f0] shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-0 pt-5 px-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-[#191c1e] text-sm">{feature.name}</h3>
                      <p className="text-xs text-[#94a3b8] mt-0.5">{feature.key} · {feature.route}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-3 px-5 pb-4 space-y-3">
                  {/* DA + EN slots */}
                  <div className="flex gap-3">
                    {(["da", "en"] as const).map((loc) => (
                      <LocaleSlot
                        key={loc}
                        locale={loc}
                        slot={feature[loc]}
                        featureKey={feature.key}
                        onUpload={() => setUpload({ featureKey: feature.key, locale: loc })}
                        onPreview={(url, title) => setPreview({ url, title })}
                        onPublish={(id) => publishMutation.mutate(id)}
                        onDelete={(id) => deleteMutation.mutate(id)}
                      />
                    ))}
                  </div>

                  {/* Test button */}
                  <button
                    onClick={() => showToast(`Test trigger simulated for ${feature.name}`, "success")}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:bg-[#f8fafc] hover:text-[#191c1e] transition-colors"
                  >
                    <Zap size={12} className="text-amber-500" />
                    Test Trigger
                  </button>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Modals */}
      <UploadModal
        open={!!upload}
        featureKey={upload?.featureKey ?? ""}
        locale={upload?.locale ?? "da"}
        features={features}
        onClose={() => setUpload(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-videos"] })}
      />

      <PreviewModal
        open={!!preview}
        title={preview?.title ?? ""}
        videoUrl={preview?.url ?? ""}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
