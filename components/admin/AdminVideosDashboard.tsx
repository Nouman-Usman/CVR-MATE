"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Eye, Play, Trash2, Zap, CheckCircle2, AlertCircle,
  X, CloudUpload, Globe, Video, Layout, CheckCircle, Loader2,
  AlertTriangle, MoreHorizontal, ExternalLink, Sparkles, MonitorPlay,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

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

// ── Status badge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="bg-rose-50/50 text-rose-600 border-rose-100 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1.5 px-2 py-0.5">
        <div className="size-1 rounded-full bg-rose-500" />
        Missing
      </Badge>
    );
  }
  if (status === "draft") {
    return (
      <Badge variant="outline" className="bg-amber-50/50 text-amber-700 border-amber-100 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1.5 px-2 py-0.5">
        <Loader2 className="size-2.5 animate-spin" />
        Draft
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 border-emerald-100 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1.5 px-2 py-0.5">
      <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Published
    </Badge>
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
      toast.success("Asset integrated successfully");
      setTimeout(() => { onSuccess(); onClose(); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Integration failed");
      setStep("error");
      toast.error(err instanceof Error ? err.message : "Integration failed");
    }
  };

  const stepLabel: Record<UploadStep, string> = {
    idle: "Integrate Asset",
    signing: "Preparing pipeline…",
    uploading: `Syncing bytes…`,
    saving: "Finalizing…",
    done: "Deployed!",
    error: "Retry Integration",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-[32px] p-8 border-none shadow-2xl">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3 mb-2">
             <div className="size-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
               <Video size={20} className="text-white" />
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Media Sync</span>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{locale === "da" ? "Danish" : "English"} Locale</span>
             </div>
          </div>
          <DialogTitle className="font-black text-2xl tracking-tight text-slate-900">Upload New Asset</DialogTitle>
          <DialogDescription className="text-slate-500 font-medium leading-relaxed">
            Integrating media for <span className="text-slate-900 font-bold">"{feature?.name}"</span> feature component.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="title" className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">Display Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dashboard Onboarding Guide"
              className="h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-blue-100/50 transition-all font-bold text-slate-900 placeholder:text-slate-300"
              required
              disabled={step !== "idle" && step !== "error"}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">Video Source</Label>
            <div
              className={cn(
                "group relative border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-300 cursor-pointer overflow-hidden",
                file 
                  ? "border-blue-600 bg-blue-50/30" 
                  : "border-slate-100 hover:border-blue-200 hover:bg-slate-50/50"
              )}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="space-y-2">
                  <div className="mx-auto size-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                    <CheckCircle size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-900 truncate px-4">{file.name}</p>
                  <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Asset Ready</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto size-12 rounded-full bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all flex items-center justify-center">
                    <CloudUpload size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600">Click or drag source</p>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium italic">High-bitrate MP4 preferred</p>
                  </div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {step === "uploading" && (
            <div className="space-y-2.5 px-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Pipeline Traffic</span>
                <span className="text-sm font-black text-slate-900 tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 rounded-full bg-slate-100 [&>div]:bg-blue-600 [&>div]:shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all duration-300" />
            </div>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            className={cn(
              "w-full rounded-[20px] font-black text-base h-16 shadow-xl transition-all active:scale-95 duration-300 border-none",
              step === "done" 
                ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" 
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
            )}
            disabled={!file || !title.trim() || (step !== "idle" && step !== "error" && step !== "done")}
            onClick={handleSubmit}
          >
            {step === "done" ? <><CheckCircle size={20} className="mr-3" /> Asset Deployed</> : stepLabel[step]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Preview modal ───────────────────────────────────────────────────────────────
function PreviewModal({
  open, title, videoUrl,
  onClose,
}: { open: boolean; title: string; videoUrl: string; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden rounded-[32px] bg-slate-950 border-none shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="relative group">
           <div className="absolute top-0 inset-x-0 p-8 flex items-center justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-b from-black/60 to-transparent">
              <h2 className="text-white font-black text-lg tracking-tight pr-12 drop-shadow-md">
                {title}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/10"
                onClick={onClose}
              >
                <X size={18} />
              </Button>
           </div>
          <video 
            src={videoUrl} 
            controls 
            autoPlay 
            className="w-full aspect-video shadow-2xl" 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Locale Module ──────────────────────────────────────────────────────────────
function LocaleModule({
  locale, slot,
  onUpload, onPreview,
  onPublish, onDelete,
}: {
  locale: "da" | "en";
  slot: VideoSlot | null;
  onUpload: () => void;
  onPreview: (url: string, title: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const videoUrl = slot?.videoPath ? `${supabaseUrl}/storage/v1/object/public/cvr-videos/${slot.videoPath}` : null;

  return (
    <div className={cn(
      "relative flex-1 flex flex-col p-5 rounded-[24px] border transition-all duration-500",
      slot 
        ? "bg-white border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.04)]" 
        : "bg-slate-50/40 border-dashed border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 group/module cursor-pointer"
    )}
    onClick={!slot ? onUpload : undefined}
    >
      {/* Module Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "size-7 rounded-xl flex items-center justify-center text-[10px] font-black tracking-tighter shadow-sm",
            locale === "da" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
          )}>
            {locale.toUpperCase()}
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            {locale === "da" ? "Danish" : "English"}
          </span>
        </div>
        <StatusBadge status={slot?.status ?? null} />
      </div>

      {slot ? (
        <div className="flex-1 flex flex-col justify-between">
          <div className="mb-4">
            <p className="text-sm font-black text-slate-900 leading-tight mb-2 line-clamp-2" title={slot.title}>
              {slot.title}
            </p>
            <div className="flex items-center gap-2">
               <span className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[9px] font-black text-slate-400 tabular-nums">
                V{slot.version}
               </span>
               <span className="text-[10px] font-bold text-slate-300">
                {new Date(slot.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
               </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {videoUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onPreview(videoUrl, slot.title); }}
                className="flex-1 h-9 rounded-xl border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:text-blue-600 font-bold text-[11px] transition-all shadow-sm"
              >
                <Eye size={14} className="mr-2" /> Preview
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger 
                render={
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-50" />
                }
              >
                 <MoreHorizontal size={15} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 border-slate-100 shadow-xl w-48">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Asset Options</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-50" />
                {slot.status === "draft" && (
                  <DropdownMenuItem 
                    className="rounded-xl font-bold text-sm text-blue-600 focus:bg-blue-50 focus:text-blue-600 px-3 py-2.5 cursor-pointer"
                    onClick={() => onPublish(slot.id)}
                  >
                    <Play size={14} className="mr-3 fill-current" /> Publish Asset
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  className="rounded-xl font-bold text-sm text-rose-600 focus:bg-rose-50 focus:text-rose-600 px-3 py-2.5 cursor-pointer"
                  onClick={() => { if (confirm("Delete this media asset permanently?")) onDelete(slot.id); }}
                >
                  <Trash2 size={14} className="mr-3" /> Delete Asset
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="size-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 group-hover/module:bg-blue-600 group-hover/module:text-white group-hover/module:border-blue-600 transition-all duration-300 shadow-sm">
            <Upload size={18} />
          </div>
          <div className="text-center">
            <span className="block text-[11px] font-black text-slate-400 group-hover/module:text-blue-600 uppercase tracking-[0.15em] transition-colors">
              No Asset
            </span>
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest group-hover/module:text-blue-600/60">
              Integrate +
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ──────────────────────────────────────────────────────────────
export function AdminVideosDashboard() {
  const queryClient = useQueryClient();
  const [upload, setUpload] = useState<{ featureKey: string; locale: "da" | "en" } | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-videos"] }); toast.success("Asset live on production"); },
    onError: () => toast.error("Deployment failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-videos"] }); toast.success("Asset removed"); },
    onError: () => toast.error("Removal failed"),
  });

  const daCoverage = features.filter((f) => f.da?.status === "published").length;
  const enCoverage = features.filter((f) => f.en?.status === "published").length;
  const drafts = features.filter((f) => f.da?.status === "draft" || f.en?.status === "draft").length;

  return (
    <div className="p-8 md:p-14 max-w-[1440px] mx-auto space-y-12 font-[family-name:var(--font-manrope)] bg-[#fafbfc] min-h-screen">
      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-600/30">
               Live
             </div>
             <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Media Command Center</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[0.9]">
            Visual Assets <span className="text-blue-600">.</span>
          </h1>
          <p className="text-lg font-bold text-slate-500 max-w-2xl leading-relaxed">
            Manage the contextual onboarding experience. High-fidelity videos are synchronized instantly across the platform's global network.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-[24px] shadow-sm border border-slate-100">
           <div className="px-5 py-3 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center gap-3">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest">Network Secure</span>
           </div>
           <Button variant="ghost" size="icon" className="rounded-2xl h-11 w-11 text-slate-400">
              <Sparkles size={18} />
           </Button>
        </div>
      </div>

      {/* High-Impact Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Deployment Targets", value: features.length, icon: MonitorPlay, color: "from-blue-600 to-blue-700", labelColor: "text-blue-600" },
          { label: "Danish Nodes", value: daCoverage, icon: Globe, color: "from-rose-500 to-rose-600", labelColor: "text-rose-600" },
          { label: "English Nodes", value: enCoverage, icon: Globe, color: "from-indigo-500 to-indigo-600", labelColor: "text-indigo-600" },
          { label: "Awaiting Sync", value: drafts, icon: Loader2, color: drafts > 0 ? "from-amber-400 to-amber-500" : "from-slate-400 to-slate-500", labelColor: drafts > 0 ? "text-amber-600" : "text-slate-500" },
        ].map((stat) => (
          <div key={stat.label} className="group relative bg-white p-1 rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-slate-100 hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] hover:scale-[1.02] transition-all duration-500 overflow-hidden">
            <div className="p-7">
              <div className="flex items-start justify-between mb-8">
                <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br shadow-lg", stat.color)}>
                  <stat.icon size={22} className={stat.label === "Awaiting Sync" && drafts > 0 ? "animate-spin" : ""} />
                </div>
                <div className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                  {isLoading ? "—" : stat.value}
                </div>
              </div>
              <p className={cn("text-[11px] font-black uppercase tracking-widest", stat.labelColor)}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Grid Header */}
      <div className="flex items-center justify-between px-2 pt-4">
        <div className="flex items-center gap-4">
           <div className="size-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <Layout size={20} />
           </div>
           <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Platform Matrix</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{features.length} ACTIVE MODULES</p>
           </div>
        </div>
      </div>

      {/* Feature Premium Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pb-20">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[400px] rounded-[48px] bg-white border border-slate-100 animate-pulse shadow-sm p-10 space-y-8">
                 <div className="flex justify-between">
                    <div className="space-y-3">
                       <div className="h-8 bg-slate-100 rounded-2xl w-48" />
                       <div className="h-4 bg-slate-50 rounded-xl w-32" />
                    </div>
                    <div className="size-14 bg-slate-100 rounded-3xl" />
                 </div>
                 <div className="grid grid-cols-2 gap-6 h-full">
                    <div className="bg-slate-50 rounded-[32px] h-48" />
                    <div className="bg-slate-50 rounded-[32px] h-48" />
                 </div>
              </div>
            ))
          : features.map((feature) => (
              <div 
                key={feature.key} 
                className="group relative bg-white rounded-[48px] p-10 border border-slate-100 transition-all duration-700 hover:shadow-[0_40px_120px_rgba(0,0,0,0.06)] hover:border-slate-200 overflow-hidden flex flex-col h-full"
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 -mr-10 -mt-10 size-64 bg-blue-50/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                {/* Card Header */}
                <div className="flex items-start justify-between relative z-10 mb-10">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors duration-500">
                      {feature.name}
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {feature.key}
                      </div>
                      <div className="flex items-center gap-1.5">
                         <div className="size-1 rounded-full bg-slate-200" />
                         <span className="text-[11px] font-bold text-slate-400">{feature.route}</span>
                      </div>
                    </div>
                  </div>
                  <div className="size-16 rounded-[24px] bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-blue-600/20 transition-all duration-500">
                    <MonitorPlay size={28} />
                  </div>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1 relative z-10">
                  <LocaleModule
                    locale="da"
                    slot={feature.da}
                    onUpload={() => setUpload({ featureKey: feature.key, locale: "da" })}
                    onPreview={(url, title) => setPreview({ url, title })}
                    onPublish={(id) => publishMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                  <LocaleModule
                    locale="en"
                    slot={feature.en}
                    onUpload={() => setUpload({ featureKey: feature.key, locale: "en" })}
                    onPreview={(url, title) => setPreview({ url, title })}
                    onPublish={(id) => publishMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                </div>

                {/* Integration Status / Simulator */}
                <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between relative z-10">
                   <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl">
                      <div className="size-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Module Active</span>
                   </div>
                   <Button
                    variant="ghost"
                    onClick={() => toast.success(`Deployment simulation successful for ${feature.name}`, { icon: <Sparkles size={14} className="text-amber-500" /> })}
                    className="rounded-2xl h-11 px-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95"
                   >
                    <Zap size={14} className="mr-2 fill-amber-500 text-amber-500" />
                    Simulate Trigger
                   </Button>
                </div>
              </div>
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

      {preview && (
        <PreviewModal
          open={!!preview}
          title={preview.title}
          videoUrl={preview.url}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
