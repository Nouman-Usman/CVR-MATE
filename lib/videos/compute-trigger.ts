export interface VideoMeta {
  version: number;
  status: string;
  isCurrent: boolean;
  isActive: boolean;
  autoShow: boolean;
  triggerType: string;
}

export interface UserState {
  hasViewed: boolean;
  lastSeenVersion: number;
  dismissed: boolean;
  completedAt: string | null;
}

export function computeTrigger(
  video: VideoMeta | null,
  userState: UserState | null
): boolean {
  if (!video) return false;
  if (video.status !== "published" || !video.isCurrent) return false;
  if (!video.isActive || !video.autoShow) return false;
  if (!["auto", "smart"].includes(video.triggerType)) return false;

  if (!userState) return true;

  // New version overrides dismissal
  const isStale = userState.lastSeenVersion < video.version;
  if (isStale) return true;

  // Dismissed without stale version = never show
  if (userState.dismissed) return false;

  // Never shown before = show
  return !userState.hasViewed;
}
