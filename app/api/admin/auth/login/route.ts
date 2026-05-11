import { NextRequest, NextResponse } from "next/server";
import { signAdminToken, comparePassword, COOKIE_NAME } from "@/lib/admin/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const emailKey = typeof email === "string" ? email.toLowerCase().trim() : "";

    // Dual limiter: one bucket per IP and one per email to reduce brute-force risk.
    // Skip shared fallback buckets (e.g. unknown IP / empty email) to avoid accidental lockouts.
    const limits = [];
    if (ip !== "unknown") {
      limits.push(
        checkRateLimit(`admin-ip:${ip}`, "admin_login_ip", 30, 60)
      );
    }
    if (emailKey) {
      limits.push(
        checkRateLimit(`admin-email:${emailKey}`, "admin_login_email", 15, 60)
      );
    }

    const limitResults = await Promise.all(limits);
    const blocked = limitResults.find((r) => !r.allowed);
    if (blocked) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((blocked.resetAt - Date.now()) / 1000)
      );
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminHash) {
      return NextResponse.json(
        { error: "Admin credentials not configured" },
        { status: 500 }
      );
    }

    const emailMatch = email === adminEmail;
    const passwordMatch = await comparePassword(password, adminHash);

    if (!emailMatch || !passwordMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await signAdminToken(email);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return res;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
