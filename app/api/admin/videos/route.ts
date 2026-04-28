import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { features, featureVideo } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrgMembership } from "@/lib/team/permissions";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only owners can view
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
        { error: "Only owners can manage videos" },
        { status: 403 }
      );
    }

    // Get all features
    const allFeatures = await db.query.features.findMany();

    // Get all videos grouped by feature+locale
    const allVideos = await db.query.featureVideo.findMany();

    const result = allFeatures.map((feature) => {
      const videos = allVideos.filter(
        (v) => v.featureKey === feature.key
      );

      const daVideo = videos.find((v) => v.locale === "da" && v.isCurrent);
      const enVideo = videos.find((v) => v.locale === "en" && v.isCurrent);

      return {
        key: feature.key,
        name: feature.name,
        route: feature.route,
        da: daVideo
          ? {
              id: daVideo.id,
              version: daVideo.version,
              status: daVideo.status,
              title: daVideo.title,
              updatedAt: daVideo.updatedAt,
            }
          : null,
        en: enVideo
          ? {
              id: enVideo.id,
              version: enVideo.version,
              status: enVideo.status,
              title: enVideo.title,
              updatedAt: enVideo.updatedAt,
            }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch admin videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
