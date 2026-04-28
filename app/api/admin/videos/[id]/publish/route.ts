import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { featureVideo } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrgMembership } from "@/lib/team/permissions";

export async function POST(
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
        { error: "Only owners can publish videos" },
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
        .set({ status: "published", isCurrent: true })
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
