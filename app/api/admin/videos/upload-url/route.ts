import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/videos/supabase";
import { getOrgMembership } from "@/lib/team/permissions";

export async function POST(req: NextRequest) {
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
        { error: "Only owners can upload videos" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Missing filename or contentType" },
        { status: 400 }
      );
    }

    const uploadUrl = await supabaseAdmin.storage
      .from("cvr-videos")
      .createSignedUploadUrl(filename);

    if (uploadUrl.error) {
      throw uploadUrl.error;
    }

    return NextResponse.json({
      uploadUrl: uploadUrl.data?.signedUrl,
      path: filename,
    });
  } catch (error) {
    console.error("Failed to generate upload URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
