import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { featureVideo, userVideoView } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getVideoUrl } from "@/lib/videos/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = await params;
    const locale = req.nextUrl.searchParams.get("locale") || "en";

    // Query: published + current + active video for feature+locale
    let video = await db.query.featureVideo.findFirst({
      where: and(
        eq(featureVideo.featureKey, key),
        eq(featureVideo.locale, locale),
        eq(featureVideo.status, "published"),
        eq(featureVideo.isCurrent, true),
        eq(featureVideo.isActive, true)
      ),
    });

    // Fallback to the other locale if requested locale not found
    if (!video) {
      const fallbackLocale = locale === "en" ? "da" : "en";
      video = await db.query.featureVideo.findFirst({
        where: and(
          eq(featureVideo.featureKey, key),
          eq(featureVideo.locale, fallbackLocale),
          eq(featureVideo.status, "published"),
          eq(featureVideo.isCurrent, true),
          eq(featureVideo.isActive, true)
        ),
      });
    }

    if (!video) {
      return NextResponse.json(null, { status: 404 });
    }

    // Get user view state
    const view = await db.query.userVideoView.findFirst({
      where: and(
        eq(userVideoView.userId, session.user.id),
        eq(userVideoView.featureKey, key)
      ),
    });

    const videoUrl = getVideoUrl(video.videoPath);
    const thumbnailUrl = video.thumbnailPath ? getVideoUrl(video.thumbnailPath) : null;

    return NextResponse.json({
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        videoUrl,
        thumbnailUrl,
        durationSeconds: video.durationSeconds,
        version: video.version,
        status: video.status,
        isCurrent: video.isCurrent,
        isActive: video.isActive,
        autoShow: video.autoShow,
        triggerType: video.triggerType,
      },
      userState: view
        ? {
            hasViewed: true,
            lastSeenVersion: view.lastSeenVersion,
            dismissed: view.dismissed,
            completedAt: view.completedAt?.toISOString() || null,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch video:", error);
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
}
