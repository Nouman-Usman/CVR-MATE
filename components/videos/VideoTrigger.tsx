"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useFeatureVideo } from "@/lib/hooks/use-feature-video";
import { routeToFeatureKey } from "@/lib/videos/route-map";
import { computeTrigger } from "@/lib/videos/compute-trigger";
import { VideoButton } from "./VideoButton";

const VideoModal = dynamic(() => import("./VideoModal").then(m => ({ default: m.VideoModal })), {
  ssr: false,
});

interface VideoTriggerProps {
  featureKey?: string;
  children?: React.ReactNode;
}

export function VideoTrigger({ featureKey: explicitKey, children }: VideoTriggerProps) {
  const pathname = usePathname();
  const [modalOpen, setModalOpen] = useState(false);
  const [autoShowTriggered, setAutoShowTriggered] = useState(false);

  // Resolve feature key: explicit > route
  const featureKey = explicitKey || routeToFeatureKey(pathname);

  const { data, isLoading } = useFeatureVideo(featureKey);

  const trackView = useCallback(
    async (payload: {
      position: number;
      completed: boolean;
      version: number;
      watchTimeDelta: number;
    }) => {
      if (!featureKey) return;

      try {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon(`/api/videos/${featureKey}/view`, blob);
      } catch (error) {
        console.warn("Failed to track video view:", error);
      }
    },
    [featureKey]
  );

  const openModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  // Auto-show on first visit
  useEffect(() => {
    if (!data || autoShowTriggered || modalOpen) return;

    const shouldAutoShow = computeTrigger(
      data.video
        ? {
            version: data.video.version,
            status: data.video.status,
            isCurrent: data.video.isCurrent,
            isActive: data.video.isActive,
            autoShow: data.video.autoShow,
            triggerType: data.video.triggerType,
          }
        : null,
      data.userState
    );

    if (!shouldAutoShow) return;

    // Check session storage guard
    const shown = sessionStorage.getItem(`video_shown_${featureKey}`);
    if (shown) return;

    // Check visibility
    if (document.hidden) return;

    const open = () => {
      sessionStorage.setItem(`video_shown_${featureKey}`, "1");
      setAutoShowTriggered(true);
      setModalOpen(true);
    };

    // requestIdleCallback with fallback
    if ("requestIdleCallback" in window) {
      requestIdleCallback(open, { timeout: 2000 });
    } else {
      setTimeout(open, 800);
    }
  }, [data, featureKey, autoShowTriggered, modalOpen]);

  // No video available
  if (!isLoading && !data?.video) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {data?.video && (
        <>
          <VideoButton onClick={openModal} />

          <VideoModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            title={data.video.title}
            description={data.video.description || undefined}
            videoUrl={data.video.videoUrl}
            thumbnailUrl={data.video.thumbnailUrl || undefined}
            durationSeconds={data.video.durationSeconds || undefined}
            version={data.video.version}
            onView={trackView}
          />
        </>
      )}
    </>
  );
}
