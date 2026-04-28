"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Upload, Trash2, CheckCircle2, Circle } from "lucide-react";

interface AdminFeatureRow {
  key: string;
  name: string;
  route: string;
  da: { id: string; version: number; status: string; title: string; updatedAt: string } | null;
  en: { id: string; version: number; status: string; title: string; updatedAt: string } | null;
}

type UploadStep = "idle" | "signing" | "uploading" | "saving" | "done" | "error";

export function AdminVideosDashboard() {
  const queryClient = useQueryClient();

  // Feature list query
  const { data: features = [], isLoading } = useQuery({
    queryKey: ["admin-videos"],
    queryFn: async () => {
      const res = await fetch("/api/admin/videos");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<AdminFeatureRow[]>;
    },
  });

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFeature, setUploadFeature] = useState<string>("");
  const [uploadLocale, setUploadLocale] = useState<"da" | "en">("da");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadError, setUploadError] = useState<string>("");

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const res = await fetch(`/api/admin/videos/${videoId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to publish");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-videos"] }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const res = await fetch(`/api/admin/videos/${videoId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-videos"] }),
  });

  const handleUploadSubmit = async () => {
    if (!uploadFeature || !uploadTitle || !uploadFile) {
      setUploadError("Fill in all fields");
      return;
    }

    try {
      setUploadError("");
      setUploadStep("signing");

      // Step 1: Get signed URL
      const ext = uploadFile.name.split(".").pop() || "mp4";
      const storagePath = `features/${uploadFeature}/${uploadLocale}/v${Date.now()}.${ext}`;

      const signRes = await fetch("/api/admin/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: storagePath,
          contentType: uploadFile.type || "video/mp4",
        }),
      });

      if (!signRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, path } = await signRes.json();

      // Step 2: Upload file to Supabase
      setUploadStep("uploading");
      setUploadProgress(0);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", uploadFile.type || "video/mp4");
        xhr.send(uploadFile);
      });

      // Step 3: Save record
      setUploadStep("saving");

      const saveRes = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureKey: uploadFeature,
          locale: uploadLocale,
          title: uploadTitle,
          videoPath: path,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? "Failed to save");
      }

      // Step 4: Success
      setUploadStep("done");
      await queryClient.invalidateQueries({ queryKey: ["admin-videos"] });

      // Close dialog after brief delay
      setTimeout(() => {
        setUploadOpen(false);
        setUploadFeature("");
        setUploadLocale("da");
        setUploadTitle("");
        setUploadFile(null);
        setUploadProgress(0);
        setUploadStep("idle");
        setUploadError("");
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setUploadError(message);
      setUploadStep("error");
    }
  };

  const statusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">No video</Badge>;
    if (status === "draft") return <Badge variant="secondary">Draft</Badge>;
    if (status === "published") return <Badge variant="default">Published</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Video Management</h1>
          <p className="text-sm text-slate-600">Upload, manage, and publish onboarding videos</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-slate-500">Loading features...</div>
      ) : features.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
          No features found
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Feature</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Danish</TableHead>
                <TableHead>English</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((feature) => (
                <TableRow key={feature.key} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-900">{feature.name}</TableCell>
                  <TableCell className="text-sm text-slate-600">{feature.route}</TableCell>
                  <TableCell>{statusBadge(feature.da?.status ?? null)}</TableCell>
                  <TableCell>{statusBadge(feature.en?.status ?? null)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Dialog open={uploadOpen && uploadFeature === feature.key} onOpenChange={(open) => {
                      if (open) setUploadFeature(feature.key);
                      setUploadOpen(open);
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUploadFeature(feature.key)}
                        >
                          <Upload className="w-4 h-4 mr-1" /> Upload
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload Video — {feature.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          {uploadError && (
                            <div className="flex items-start gap-2 rounded bg-red-50 p-3 text-sm text-red-900">
                              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <div>{uploadError}</div>
                            </div>
                          )}

                          {uploadStep === "done" ? (
                            <div className="flex items-center gap-2 rounded bg-green-50 p-4 text-green-900">
                              <CheckCircle2 className="w-5 h-5" />
                              <span>Video uploaded successfully!</span>
                            </div>
                          ) : (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                  Locale
                                </label>
                                <Select value={uploadLocale} onValueChange={(v) => setUploadLocale(v as "da" | "en")}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="da">Danish (Dansk)</SelectItem>
                                    <SelectItem value="en">English</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                  Title
                                </label>
                                <Input
                                  placeholder="e.g., Search Feature Walkthrough"
                                  value={uploadTitle}
                                  onChange={(e) => setUploadTitle(e.target.value)}
                                  disabled={uploadStep !== "idle"}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                  Video File
                                </label>
                                <Input
                                  type="file"
                                  accept="video/*"
                                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                                  disabled={uploadStep !== "idle"}
                                />
                              </div>

                              {uploadStep !== "idle" && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Circle className="w-4 h-4 animate-spin" />
                                    {uploadStep === "signing" && "Getting upload URL..."}
                                    {uploadStep === "uploading" && `Uploading... ${uploadProgress}%`}
                                    {uploadStep === "saving" && "Saving to database..."}
                                    {uploadStep === "error" && "Upload failed"}
                                  </div>
                                  {uploadStep === "uploading" && <Progress value={uploadProgress} />}
                                </div>
                              )}
                            </>
                          )}

                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setUploadOpen(false);
                                setUploadError("");
                                setUploadStep("idle");
                              }}
                            >
                              {uploadStep === "done" ? "Close" : "Cancel"}
                            </Button>
                            {uploadStep !== "done" && uploadStep !== "error" && (
                              <Button
                                onClick={handleUploadSubmit}
                                disabled={uploadStep !== "idle" || !uploadTitle || !uploadFile}
                              >
                                Upload
                              </Button>
                            )}
                            {uploadStep === "error" && (
                              <Button
                                onClick={() => {
                                  setUploadError("");
                                  setUploadStep("idle");
                                }}
                              >
                                Try Again
                              </Button>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {feature.da?.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => publishMutation.mutate(feature.da!.id)}
                        disabled={publishMutation.isPending}
                      >
                        {publishMutation.isPending ? "Publishing..." : "Publish DA"}
                      </Button>
                    )}

                    {feature.en?.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => publishMutation.mutate(feature.en!.id)}
                        disabled={publishMutation.isPending}
                      >
                        {publishMutation.isPending ? "Publishing..." : "Publish EN"}
                      </Button>
                    )}

                    {feature.da?.status === "draft" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(feature.da!.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}

                    {feature.en?.status === "draft" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(feature.en!.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
