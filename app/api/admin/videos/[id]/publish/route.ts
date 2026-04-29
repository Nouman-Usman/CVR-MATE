import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { featureVideo } from "@/db/schema";
import { verifyAdminToken } from "@/lib/admin/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCookie = (await cookies()).get("admin-session")?.value;
    const adminEmail = await verifyAdminToken(adminCookie);
    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const video = await db.query.featureVideo.findFirst({
      where: eq(featureVideo.id, id),
    });

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Transaction: publish new, unpublish old
    await db.transaction(async (tx) => {
      // Find current published version
      const current = await tx.query.featureVideo.findFirst({
        where: and(
          eq(featureVideo.featureKey, video.featureKey),
          eq(featureVideo.locale, video.locale),
          eq(featureVideo.isCurrent, true),
          eq(featureVideo.status, "published")
        ),
      });

      // Flip current to false if exists
      if (current && current.id !== id) {
        await tx
          .update(featureVideo)
          .set({ isCurrent: false })
          .where(eq(featureVideo.id, current.id));
      }

      // Publish new
      await tx
        .update(featureVideo)
        .set({ status: "published", isCurrent: true, isActive: true })
        .where(eq(featureVideo.id, id));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to publish video:", error);
    return NextResponse.json(
      { error: "Failed to publish video" },
      { status: 500 }
    );
  }
}
