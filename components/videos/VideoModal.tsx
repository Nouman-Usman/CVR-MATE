"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { VideoUnavailable } from "./VideoUnavailable";
import { X } from "lucide-react";

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

    return () => {
      // On unmount/close, track view
      if (videoRef.current && onView) {
        const watchTime = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );
        const position = Math.floor(videoRef.current.currentTime);
        const duration = Math.floor(videoRef.current.duration);
        const completed = duration > 0 && position / duration >= 0.8;

        onView({
          position,
          completed,
          version,
          watchTimeDelta: watchTime,
        });
      }
    };
  }, [open, onView, version]);

  const handleVideoError = () => {
    setError(true);
  };

  const handleCompleted = () => {
    if (videoRef.current && onView) {
      const watchTime = Math.floor(
        (Date.now() - startTimeRef.current) / 1000
      );
      onView({
        position: Math.floor(videoRef.current.duration),
        completed: true,
        version,
        watchTimeDelta: watchTime,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
          <DialogClose
            render={
              <button className="absolute right-4 top-4 p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            }
          />
        </DialogHeader>

        <div className="mt-4">
          {error ? (
            <VideoUnavailable />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={thumbnailUrl || undefined}
              controls
              preload="none"
              className="w-full bg-black rounded-lg"
              onError={handleVideoError}
              onEnded={handleCompleted}
            />
          )}

          {durationSeconds && !error && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              {Math.floor(durationSeconds / 60)}:{String(durationSeconds % 60).padStart(2, "0")} min
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
