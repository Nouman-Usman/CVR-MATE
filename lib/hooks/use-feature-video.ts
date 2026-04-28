"use client";

import { useQuery } from "@tanstack/react-query";
import { useLanguagePreferenceValue } from "./use-language";

interface VideoData {
  video: {
    id: string;
    title: string;
    description: string | null;
    videoUrl: string;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    version: number;
    status: string;
    isCurrent: boolean;
    isActive: boolean;
    autoShow: boolean;
    triggerType: string;
  };
  userState: {
    hasViewed: boolean;
    lastSeenVersion: number;
    dismissed: boolean;
    completedAt: string | null;
  } | null;
}

export function useFeatureVideo(featureKey: string | null) {
  const locale = useLanguagePreferenceValue();

  return useQuery<VideoData | null>({
    queryKey: ["video", featureKey, locale],
    queryFn: async () => {
      if (!featureKey) return null;

      const res = await fetch(
        `/api/videos/${featureKey}?locale=${locale}`
      );

      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch video");

      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!featureKey,
  });
}
