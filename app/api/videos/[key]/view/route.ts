import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { userVideoView } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = await params;
    const body = await req.json();
    const { position, completed, version, watchTimeDelta } = body;

    const userId = session.user.id;

    // Upsert user_video_view
    const existing = await db.query.userVideoView.findFirst({
      where: and(
        eq(userVideoView.userId, userId),
        eq(userVideoView.featureKey, key)
      ),
    });

    if (existing) {
      // Update existing
      await db
        .update(userVideoView)
        .set({
          lastPositionSeconds: position ?? existing.lastPositionSeconds,
          completedAt: completed ? new Date() : existing.completedAt,
          lastSeenVersion: version || existing.lastSeenVersion,
          viewCount: existing.viewCount + 1,
          totalWatchTimeSeconds:
            (existing.totalWatchTimeSeconds || 0) + (watchTimeDelta || 0),
        })
        .where(
          and(
            eq(userVideoView.userId, userId),
            eq(userVideoView.featureKey, key)
          )
        );
    } else {
      // Insert new
      await db.insert(userVideoView).values({
        userId,
        featureKey: key,
        lastPositionSeconds: position || null,
        completedAt: completed ? new Date() : null,
        lastSeenVersion: version || 1,
        viewCount: 1,
        totalWatchTimeSeconds: watchTimeDelta || 0,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to track video view:", error);
    return NextResponse.json(
      { error: "Failed to track view" },
      { status: 500 }
    );
  }
}
