import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/videos/supabase";
import { verifyAdminToken } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  try {
    const adminCookie = (await cookies()).get("admin-session")?.value;
    const adminEmail = await verifyAdminToken(adminCookie);
    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
