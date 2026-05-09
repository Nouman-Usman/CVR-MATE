import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user, verification, account } from "@/db/auth-schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invalid reset token" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find verification token
    const verificationRecord = await db.query.verification.findFirst({
      where: eq(verification.value, token),
    });

    if (!verificationRecord || !verificationRecord.expiresAt || verificationRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Token has expired. Request a new password reset." },
        { status: 400 }
      );
    }

    // Find user by email from verification record
    const userRecord = await db.query.user.findFirst({
      where: eq(user.email, verificationRecord.identifier),
    });

    if (!userRecord) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 400 }
      );
    }

    // Hash the new password using better-auth's hashPassword function
    const hashedPassword = await hashPassword(password);

    // Find and update the account's password
    const userAccount = await db.query.account.findFirst({
      where: and(
        eq(account.userId, userRecord.id),
        eq(account.providerId, "credential")
      ),
    });

    if (userAccount) {
      await db
        .update(account)
        .set({ password: hashedPassword })
        .where(eq(account.id, userAccount.id));
    } else {
      // Create a credential account if it doesn't exist
      await db.insert(account).values({
        id: crypto.randomBytes(16).toString("hex"),
        userId: userRecord.id,
        accountId: `credential_${userRecord.id}`,
        providerId: "credential",
        password: hashedPassword,
      });
    }

    // Delete the verification token after successful reset
    await db.delete(verification).where(eq(verification.value, token));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
