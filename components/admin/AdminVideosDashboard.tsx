"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";

interface AdminFeatureRow {
  key: string;
  name: string;
  route: string;
  da: { id: string; version: number; status: string; title: string; updatedAt: string; videoPath?: string } | null;
  en: { id: string; version: number; status: string; title: string; updatedAt: string; videoPath?: string } | null;
}

type UploadStep = "idle" | "signing" | "uploading" | "saving" | "done" | "error";
type Toast = { message: string; type: "success" | "error" } | null;

const COLORS = {
  bg: "#0f172a",
  surface: "#1e293b",
  border: "#334155",
  text: "#f1f5f9",
  textSecondary: "#64748b",
  blue: "#3b82f6",
  green: "#10b981",
  emerald: "#14532d",
  amber: "#fbbf24",
  amberBg: "#2d1f07",
  red: "#f87171",
  redBg: "#3f1d1d",
  purple: "#a78bfa",
  purpleBg: "#1e1e3f",
};

const Toast = ({ toast }: { toast: Toast }) => {
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: toast.type === "success" ? COLORS.emerald : COLORS.redBg,
        border: `1px solid ${toast.type === "success" ? COLORS.green : COLORS.red}`,
        borderRadius: "6px",
        padding: "12px 16px",
        color: toast.type === "success" ? COLORS.green : COLORS.red,
        fontSize: "13px",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <span>{toast.message}</span>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) {
    return (
      <span style={{ background: COLORS.redBg, color: COLORS.red, padding: "2px 8px", borderRadius: "10px", fontSize: "11px", display: "inline-block" }}>
        missing
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span style={{ background: COLORS.amberBg, color: COLORS.amber, padding: "2px 8px", borderRadius: "10px", fontSize: "11px", display: "inline-block" }}>
        draft
      </span>
    );
  }
  if (status === "published") {
    return (
      <span style={{ background: COLORS.emerald, color: COLORS.green, padding: "2px 8px", borderRadius: "10px", fontSize: "11px", display: "inline-block" }}>
        published
      </span>
    );
  }
  return null;
};

export function AdminVideosDashboard() {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFeature, setUploadFeature] = useState<string>("");
  const [uploadLocale, setUploadLocale] = useState<"da" | "en">("da");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadError, setUploadError] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{ path?: string; title: string } | null>(null);
  const [testTriggerOpen, setTestTriggerOpen] = useState(false);
  const [testFeature, setTestFeature] = useState<AdminFeatureRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string>("");
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const { data: features = [], isLoading } = useQuery({
    queryKey: ["admin-videos"],
    queryFn: async () => {
      const res = await fetch("/api/admin/videos");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<AdminFeatureRow[]>;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const res = await fetch(`/api/admin/videos/${videoId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to publish");
    },
    onSuccess: () => {
      setToast({ message: "Video published successfully", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
    },
    onError: (err) => {
      setToast({ message: err instanceof Error ? err.message : "Publish failed", type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const res = await fetch(`/api/admin/videos/${videoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      setToast({ message: "Video deleted", type: "success" });
      setDeleteConfirm("");
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
    },
    onError: (err) => {
      setToast({ message: err instanceof Error ? err.message : "Delete failed", type: "error" });
    },
  });

  const handleUploadSubmit = async () => {
    if (!uploadFeature || !uploadTitle || !uploadFile) {
      setUploadError("Fill in all fields");
      return;
    }

    try {
      setUploadError("");
      setUploadStep("signing");

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
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed with status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", uploadFile.type || "video/mp4");
        xhr.send(uploadFile);
      });

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

      setUploadStep("done");
      setToast({ message: "Video uploaded successfully", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin-videos"] });

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

  const daCoverage = features.filter((f) => f.da?.status === "published").length;
  const enCoverage = features.filter((f) => f.en?.status === "published").length;
  const drafts = features.filter((f) => f.da?.status === "draft" || f.en?.status === "draft").length;

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", padding: "12px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ color: COLORS.text, fontSize: "24px", fontWeight: "600", margin: "0 0 4px 0" }}>Feature Videos</h1>
          <p style={{ color: COLORS.textSecondary, fontSize: "12px", margin: 0 }}>Contextual tutorials shown to users · owner only</p>
        </div>

        {/* Coverage Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "24px" }}>
          <div style={{ background: COLORS.surface, borderRadius: "8px", padding: "10px 16px", border: `1px solid ${COLORS.border}` }}>
            <div style={{ color: COLORS.textSecondary, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>DA Coverage</div>
            <div style={{ color: COLORS.green, fontSize: "18px", fontWeight: "700", marginTop: "2px" }}>
              {daCoverage}/{features.length}
            </div>
          </div>
          <div style={{ background: COLORS.surface, borderRadius: "8px", padding: "10px 16px", border: `1px solid ${COLORS.border}` }}>
            <div style={{ color: COLORS.textSecondary, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>EN Coverage</div>
            <div style={{ color: COLORS.amber, fontSize: "18px", fontWeight: "700", marginTop: "2px" }}>
              {enCoverage}/{features.length}
            </div>
          </div>
          <div style={{ background: COLORS.surface, borderRadius: "8px", padding: "10px 16px", border: `1px solid ${COLORS.border}` }}>
            <div style={{ color: COLORS.textSecondary, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Drafts</div>
            <div style={{ color: "#f472b6", fontSize: "18px", fontWeight: "700", marginTop: "2px" }}>
              {drafts} pending
            </div>
          </div>
        </div>

        {/* Features Grid */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "32px", color: COLORS.textSecondary }}>Loading features...</div>
        ) : features.length === 0 ? (
          <div style={{ background: COLORS.surface, borderRadius: "8px", padding: "24px", textAlign: "center", color: COLORS.textSecondary, border: `1px solid ${COLORS.border}` }}>
            No features found
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {features.map((feature) => (
              <div key={feature.key} style={{ background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <h3 style={{ color: COLORS.text, fontSize: "14px", fontWeight: "600", margin: "0 0 4px 0" }}>{feature.name}</h3>
                  <p style={{ color: COLORS.textSecondary, fontSize: "11px", margin: 0 }}>
                    {feature.key} · {feature.route}
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ background: COLORS.bg, padding: "8px", borderRadius: "6px" }}>
                    <div style={{ fontSize: "9px", color: COLORS.textSecondary, marginBottom: "4px" }}>DA</div>
                    <StatusBadge status={feature.da?.status ?? null} />
                  </div>
                  <div style={{ background: COLORS.bg, padding: "8px", borderRadius: "6px" }}>
                    <div style={{ fontSize: "9px", color: COLORS.textSecondary, marginBottom: "4px" }}>EN</div>
                    <StatusBadge status={feature.en?.status ?? null} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {feature.da ? (
                    <>
                      <button
                        onClick={() => {
                          setPreviewVideo({ path: feature.da?.videoPath, title: feature.da?.title || "Video" });
                          setPreviewOpen(true);
                        }}
                        style={{ background: "transparent", border: "none", color: COLORS.purple, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left" }}
                      >
                        👁 Preview
                      </button>
                      <button
                        onClick={() => {
                          setTestFeature(feature);
                          setTestTriggerOpen(true);
                        }}
                        style={{ background: "transparent", border: "none", color: COLORS.amber, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left" }}
                      >
                        ⚡ Test
                      </button>
                      {feature.da.status === "draft" && (
                        <>
                          <button
                            onClick={() => publishMutation.mutate(feature.da!.id)}
                            disabled={publishMutation.isPending}
                            style={{ background: "transparent", border: "none", color: COLORS.green, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left", fontWeight: "600" }}
                          >
                            ✓ Publish DA
                          </button>
                          {deleteConfirm !== feature.da.id ? (
                            <button
                              onClick={() => setDeleteConfirm(feature.da!.id)}
                              style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left" }}
                            >
                              🗑️ Delete
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => deleteMutation.mutate(feature.da!.id)}
                                disabled={deleteMutation.isPending}
                                style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left", fontWeight: "600" }}
                              >
                                Confirm Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirm("")}
                                style={{ background: "transparent", border: "none", color: COLORS.textSecondary, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left" }}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setUploadFeature(feature.key);
                        setUploadLocale("da");
                        setUploadOpen(true);
                      }}
                      style={{ background: "transparent", border: "none", color: COLORS.green, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left" }}
                    >
                      + Upload DA
                    </button>
                  )}

                  {feature.en ? (
                    <>
                      {feature.en.status === "draft" && (
                        <button
                          onClick={() => publishMutation.mutate(feature.en!.id)}
                          disabled={publishMutation.isPending}
                          style={{ background: "transparent", border: "none", color: COLORS.green, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left", fontWeight: "600" }}
                        >
                          ✓ Publish EN
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setUploadFeature(feature.key);
                        setUploadLocale("en");
                        setUploadOpen(true);
                      }}
                      style={{ background: "transparent", border: "none", color: COLORS.green, cursor: "pointer", fontSize: "12px", padding: "4px 0", textAlign: "left" }}
                    >
                      + Upload EN
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "12px",
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            style={{
              background: COLORS.surface,
              borderRadius: "8px",
              overflow: "hidden",
              maxWidth: "600px",
              width: "100%",
              border: `1px solid ${COLORS.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: COLORS.bg, padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: COLORS.text, fontSize: "14px", fontWeight: "600", margin: 0 }}>{previewVideo?.title}</h2>
              <button onClick={() => setPreviewOpen(false)} style={{ background: "transparent", border: "none", color: COLORS.textSecondary, cursor: "pointer", fontSize: "20px" }}>
                ×
              </button>
            </div>
            <div style={{ background: COLORS.bg, padding: "20px", minHeight: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {previewVideo?.path ? (
                <video src={`${previewVideo.path}?timestamp=${Date.now()}`} controls style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "4px" }}>
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div style={{ color: COLORS.textSecondary, textAlign: "center" }}>
                  <p>No video path available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test Trigger Modal */}
      {testTriggerOpen && testFeature && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "12px",
          }}
          onClick={() => setTestTriggerOpen(false)}
        >
          <div
            style={{
              background: COLORS.surface,
              borderRadius: "8px",
              padding: "20px",
              maxWidth: "400px",
              width: "100%",
              border: `1px solid ${COLORS.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: COLORS.text, fontSize: "14px", fontWeight: "600", marginTop: 0, marginBottom: "8px" }}>Test Trigger — {testFeature.name}</h2>
            <p style={{ color: COLORS.textSecondary, fontSize: "11px", marginBottom: "12px" }}>Simulate what a user would experience under different conditions</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                { label: "First-time visitor (never seen)", emoji: "👁️" },
                { label: "Returning user (seen v1, now v2)", emoji: "↩️" },
                { label: "User who dismissed video", emoji: "🚫" },
                { label: "Manual trigger (button-only)", emoji: "🔘" },
              ].map((scenario, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setToast({ message: `Simulated: ${scenario.label}`, type: "success" });
                    setTestTriggerOpen(false);
                  }}
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: COLORS.textSecondary,
                    cursor: "pointer",
                    fontSize: "11px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{scenario.label}</span>
                  <span style={{ color: COLORS.blue }}>▶ Run</span>
                </button>
              ))}
            </div>

            <p style={{ color: COLORS.textSecondary, fontSize: "10px", marginTop: "10px", marginBottom: 0 }}>Simulations don't write to DB — safe to run anytime</p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button
                onClick={() => setTestTriggerOpen(false)}
                style={{
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "4px",
                  padding: "6px 12px",
                  color: COLORS.text,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "12px",
          }}
          onClick={() => !uploadStep || uploadStep === "idle" || uploadStep === "done" || uploadStep === "error" ? setUploadOpen(false) : null}
        >
          <div
            style={{
              background: COLORS.surface,
              borderRadius: "8px",
              padding: "20px",
              maxWidth: "400px",
              width: "100%",
              border: `1px solid ${COLORS.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: COLORS.text, fontSize: "16px", fontWeight: "600", marginTop: 0, marginBottom: "12px" }}>Upload Video — {features.find((f) => f.key === uploadFeature)?.name}</h2>

            {uploadError && (
              <div style={{ background: COLORS.redBg, border: `1px solid ${COLORS.red}`, borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", color: COLORS.red, fontSize: "12px", display: "flex", gap: "8px" }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadStep === "done" ? (
              <div style={{ background: "#14532d", borderRadius: "6px", padding: "12px", marginBottom: "12px", color: COLORS.green, display: "flex", gap: "8px", alignItems: "center" }}>
                <CheckCircle2 size={20} />
                <span>Video uploaded successfully!</span>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: COLORS.text, marginBottom: "4px" }}>Locale</label>
                  <select
                    value={uploadLocale}
                    onChange={(e) => setUploadLocale(e.target.value as "da" | "en")}
                    disabled={uploadStep !== "idle"}
                    style={{
                      width: "100%",
                      background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: "4px",
                      padding: "6px 8px",
                      color: COLORS.text,
                      fontSize: "12px",
                    }}
                  >
                    <option value="da">Danish (Dansk)</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: COLORS.text, marginBottom: "4px" }}>Title</label>
                  <input
                    type="text"
                    placeholder="e.g., Feature Overview"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    disabled={uploadStep !== "idle"}
                    style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "4px", padding: "6px 8px", color: COLORS.text, fontSize: "12px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: COLORS.text, marginBottom: "4px" }}>Video File</label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    disabled={uploadStep !== "idle"}
                    style={{ width: "100%", fontSize: "12px", color: COLORS.text }}
                  />
                </div>

                {uploadStep !== "idle" && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: COLORS.textSecondary }}>
                      <Circle size={14} style={{ animation: "spin 1s linear infinite" }} />
                      {uploadStep === "signing" && "Getting upload URL..."}
                      {uploadStep === "uploading" && `Uploading... ${uploadProgress}%`}
                      {uploadStep === "saving" && "Saving to database..."}
                      {uploadStep === "error" && "Upload failed"}
                    </div>
                    {uploadStep === "uploading" && (
                      <div style={{ width: "100%", height: "4px", background: COLORS.bg, borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: COLORS.blue, width: `${uploadProgress}%`, transition: "width 0.3s" }} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={() => {
                  setUploadOpen(false);
                  setUploadError("");
                  setUploadStep("idle");
                }}
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "4px", padding: "6px 12px", color: COLORS.text, fontSize: "12px", cursor: "pointer" }}
              >
                {uploadStep === "done" ? "Close" : "Cancel"}
              </button>
              {uploadStep !== "done" && uploadStep !== "error" && (
                <button
                  onClick={handleUploadSubmit}
                  disabled={uploadStep !== "idle" || !uploadTitle || !uploadFile}
                  style={{
                    background: COLORS.blue,
                    border: "none",
                    borderRadius: "4px",
                    padding: "6px 12px",
                    color: "white",
                    fontSize: "12px",
                    cursor: uploadStep === "idle" && uploadTitle && uploadFile ? "pointer" : "not-allowed",
                    opacity: uploadStep === "idle" && uploadTitle && uploadFile ? 1 : 0.5,
                  }}
                >
                  Upload
                </button>
              )}
              {uploadStep === "error" && (
                <button
                  onClick={() => {
                    setUploadError("");
                    setUploadStep("idle");
                  }}
                  style={{ background: COLORS.blue, border: "none", borderRadius: "4px", padding: "6px 12px", color: "white", fontSize: "12px", cursor: "pointer" }}
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
