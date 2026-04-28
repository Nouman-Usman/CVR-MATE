import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { featureVideo } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/videos/supabase";
import { getOrgMembership } from "@/lib/team/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = session.session?.activeOrganizationId;
    if (!org) {
      return NextResponse.json(
        { error: "No organization context" },
        { status: 403 }
      );
    }

    const membership = await getOrgMembership(session.user.id, org);
    if (!membership || membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can delete videos" },
        { status: 403 }
      );
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
