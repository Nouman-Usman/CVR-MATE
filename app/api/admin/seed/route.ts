import { NextResponse } from "next/server";
import { db } from "@/db";
import { features } from "@/db/schema";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/admin/auth";

const FEATURES = [
  { key: "search", name: "Company Search", route: "/search" },
  { key: "triggers", name: "Lead Triggers", route: "/triggers" },
  { key: "dashboard", name: "Dashboard", route: "/dashboard" },
  { key: "exports", name: "Exports", route: "/exports" },
];

export async function POST() {
  try {
    const adminCookie = (await cookies()).get("admin-session")?.value;
    const adminEmail = await verifyAdminToken(adminCookie);
    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    for (const feature of FEATURES) {
      await db.insert(features).values(feature).onConflictDoNothing();
    }

    const all = await db.query.features.findMany();
    return NextResponse.json({ success: true, count: all.length });
  } catch (error) {
    console.error("Seed failed:", error);
    return NextResponse.json(
      { error: "Seed failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
