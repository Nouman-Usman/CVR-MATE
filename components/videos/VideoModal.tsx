"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { VideoUnavailable } from "./VideoUnavailable";

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  onView?: (data: {
    position: number;
    completed: boolean;
    version: number;
    watchTimeDelta: number;
  }) => void;
  version: number;
}

export function VideoModal({
  open,
  onOpenChange,
  title,
  description,
  videoUrl,
  thumbnailUrl,
  durationSeconds,
  onView,
  version,
}: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!open) return;
    startTimeRef.current = Date.now();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      if (videoRef.current && onView) {
        const watchTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const position = Math.floor(videoRef.current.currentTime);
        const duration = Math.floor(videoRef.current.duration || 0);
        const completed = duration > 0 && position / duration >= 0.8;
        onView({ position, completed, version, watchTimeDelta: watchTime });
      }
    };
  }, [open, onView, version, onOpenChange]);

  if (!open) return null;

  const handleCompleted = () => {
    if (videoRef.current && onView) {
      const watchTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
      onView({
        position: Math.floor(videoRef.current.duration),
        completed: true,
        version,
        watchTimeDelta: watchTime,
      });
    }
  };

  const formattedDuration = durationSeconds
    ? `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => onOpenChange(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "600px",
          background: "#0f172a",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "20px 20px 16px",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 600,
                color: "#f1f5f9",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h2>
            {description && (
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94a3b8" }}>
                {description}
              </p>
            )}
            {formattedDuration && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: "8px",
                  fontSize: "11px",
                  color: "#64748b",
                  background: "rgba(255,255,255,0.05)",
                  padding: "2px 8px",
                  borderRadius: "20px",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {formattedDuration} min
              </span>
            )}
          </div>

          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            style={{
              flexShrink: 0,
              marginLeft: "12px",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.15)";
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Video */}
        <div style={{ background: "#000" }}>
          {error ? (
            <div style={{ padding: "32px" }}>
              <VideoUnavailable />
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={thumbnailUrl}
              controls
              preload="metadata"
              style={{ width: "100%", display: "block", maxHeight: "340px" }}
              onError={() => setError(true)}
              onEnded={handleCompleted}
            />
          )}
        </div>
      </div>
    </div>
  );
}
