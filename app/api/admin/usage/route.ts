import { db } from "@/db";
import { member, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";
import {
  getUsageSummary,
  getMemberUsageSummary,
  checkSeatLimit,
  getOrgPlan,
} from "@/lib/stripe/entitlements";

// GET /api/admin/usage — org usage overview + per-member breakdown
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "billing", action: "read" });

    const [orgPlan, usage, seatInfo, memberUsage] = await Promise.all([
      getOrgPlan(orgId),
      getUsageSummary(orgId),
      checkSeatLimit(orgId),
      getMemberUsageSummary(orgId),
    ]);

    // Get member names for the usage breakdown
    const members = await db
      .select({
        userId: member.userId,
        userName: user.name,
        userEmail: user.email,
        role: member.role,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId));

    const memberMap = new Map(
      members.map((m) => [m.userId, { name: m.userName, email: m.userEmail, role: m.role }])
    );

    const memberBreakdown = memberUsage.map((mu) => ({
      ...mu,
      ...(memberMap.get(mu.userId) ?? { name: "Unknown", email: "", role: "member" }),
    }));

    return Response.json({
      plan: orgPlan.plan,
      status: orgPlan.status,
      usage,
      seats: {
        current: seatInfo.currentSeats,
        max: seatInfo.maxSeats,
      },
      memberBreakdown,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
