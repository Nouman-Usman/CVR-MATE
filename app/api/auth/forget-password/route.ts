import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user, verification } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import { sendResetPasswordEmail } from "@/lib/email/senders/reset-password";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Application base URL is not configured" },
        { status: 500 }
      );
    }

    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find user by email
    const userRecord = await db.query.user.findFirst({
      where: eq(user.email, email),
    });

    if (!userRecord) {
      // Don't reveal if email exists (security best practice)
      return NextResponse.json({
        success: true,
        message: "If an account exists, a reset email has been sent",
      });
    }

    // Generate password reset token (valid for 1 hour)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store verification token for password reset
    await db.insert(verification).values({
      id: crypto.randomBytes(16).toString("hex"),
      identifier: userRecord.email,
      value: token,
      expiresAt,
    });

    const resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`;

    // Send reset email
    await sendResetPasswordEmail({
      to: userRecord.email,
      userName: userRecord.name || userRecord.email,
      resetUrl,
      userId: userRecord.id,
    });

    return NextResponse.json({
      success: true,
      message: "If an account exists, a reset email has been sent",
    });
  } catch (error) {
    console.error("Forget password error:", error);
    return NextResponse.json(
      { error: "Failed to send reset email" },
      { status: 500 }
    );
  }
}
