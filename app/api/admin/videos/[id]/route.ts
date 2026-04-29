import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { featureVideo } from "@/db/schema";
import { supabaseAdmin } from "@/lib/videos/supabase";
import { verifyAdminToken } from "@/lib/admin/auth";

export async function DELETE(
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

    // Only allow deletion of non-current videos
    if (video.isCurrent) {
      return NextResponse.json(
        { error: "Cannot delete current version" },
        { status: 400 }
      );
    }

    // Delete from Supabase Storage
    if (video.videoPath) {
      await supabaseAdmin.storage
        .from("cvr-videos")
        .remove([video.videoPath]);
    }

    if (video.thumbnailPath) {
      await supabaseAdmin.storage
        .from("cvr-videos")
        .remove([video.thumbnailPath]);
    }

    // Delete from DB
    await db.delete(featureVideo).where(eq(featureVideo.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete video:", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}
