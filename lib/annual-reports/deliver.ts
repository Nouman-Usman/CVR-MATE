import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { annualReportDigest, followedCompany } from "@/db/schema";
import { dispatchNotificationEmail } from "@/lib/email/dispatch";
import { createNotification } from "@/lib/notifications";

import type { AnnualReportPeriod } from "./periods";
import { groupByRecipient, type OrgMember, type FollowRecord } from "./recipients";
import { renderAnnualReport } from "./render";


export interface NotifiablePeriod {
  cvr: string;
  period: AnnualReportPeriod;
  followIds: string[];
}

export interface DeliveryResult {
  recipients: number;
  notificationsCreated: number;
  digestsSent: number;
  digestsSkipped: number;
  errors: { userId: string; error: string }[];
}

interface DigestItem {
  cvr: string;
  companyName: string;
  period: AnnualReportPeriod;
  previous: AnnualReportPeriod | null;
  organizationId: string | null;
}

export async function deliverAnnualReports(
  notifiable: NotifiablePeriod[],
  options: { today?: string } = {}
): Promise<DeliveryResult> {
  const empty: DeliveryResult = {
    recipients: 0,
    notificationsCreated: 0,
    digestsSent: 0,
    digestsSkipped: 0,
    errors: [],
  };
  if (notifiable.length === 0) return empty;

  const followIds = [...new Set(notifiable.flatMap((n) => n.followIds))];
  const follows = await db
    .select({
      id: followedCompany.id,
      userId: followedCompany.userId,
      organizationId: followedCompany.organizationId,
      companyName: followedCompany.companyName,
    })
    .from(followedCompany)
    .where(inArray(followedCompany.id, followIds));

  const followById = new Map(follows.map((f) => [f.id, f]));

  // One roster query for every organization involved.
  const orgIds = [...new Set(follows.map((f) => f.organizationId).filter(Boolean))] as string[];
  const membersByOrg = new Map<string, OrgMember[]>();
  if (orgIds.length > 0) {
    const rows = await db
      .select({ organizationId: member.organizationId, userId: member.userId, role: member.role })
      .from(member)
      .where(inArray(member.organizationId, orgIds));
    for (const row of rows) {
      const list = membersByOrg.get(row.organizationId) ?? [];
      list.push({ userId: row.userId, role: row.role as OrgMember["role"] });
      membersByOrg.set(row.organizationId, list);
    }
  }

  const items: { follow: FollowRecord; payload: DigestItem }[] = [];
  for (const entry of notifiable) {
    for (const followId of entry.followIds) {
      const follow = followById.get(followId);
      if (!follow) continue;
      items.push({
        follow: { id: follow.id, userId: follow.userId, organizationId: follow.organizationId },
        payload: {
          cvr: entry.cvr,
          companyName: follow.companyName,
          period: entry.period,
          previous: null,
          organizationId: follow.organizationId,
        },
      });
    }
  }

  // Keyed on the report, so one that reaches a recipient through several
  // follows is one line in their digest rather than several.
  const byRecipient = groupByRecipient(
    items,
    membersByOrg,
    (p) => `${p.cvr}:${p.period.periodEnd}`
  );

  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const result: DeliveryResult = { ...empty, recipients: byRecipient.size };

  for (const [userId, reports] of byRecipient) {
    try {
      for (const report of reports) {
        const rendered = renderAnnualReport({
          companyName: report.companyName,
          period: report.period,
          previous: report.previous,
          locale: "da",
        });

        await createNotification({
          userId,
          // Carried so the list can label the workspace and the link resolves
          // for a reader whose active org differs.
          organizationId: report.organizationId,
          type: "annual_report",
          title: rendered.title,
          message: [rendered.message, rendered.filingNote].filter(Boolean).join(" · "),
          link: `/company/${report.cvr}`,
        });
        result.notificationsCreated++;
      }

      const claimed = await claimDigest(userId, today);
      if (!claimed) {
        result.digestsSkipped++;
        continue;
      }
      await dispatchNotificationEmail({
        templateId: "annual_report_digest",
        userId,
        data: {
          reportCount: reports.length,
          reports: reports.map((r) => ({
            cvr: r.cvr,
            companyName: r.companyName,
            periodEnd: r.period.periodEnd,
            publicdate: r.period.publicdate,
            documentUrl: r.period.documentUrl,
            summary: r.period.summary,
          })),
        },
      });
      result.digestsSent++;
    } catch (error) {
      result.errors.push({
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

async function claimDigest(userId: string, today: string): Promise<boolean> {
  const claimed = await db
    .insert(annualReportDigest)
    .values({ userId, lastDigestOn: today })
    .onConflictDoUpdate({
      target: annualReportDigest.userId,
      set: { lastDigestOn: today },
      setWhere: sql`${annualReportDigest.lastDigestOn} is distinct from ${today}::date`,
    })
    .returning({ id: annualReportDigest.id });

  return claimed.length > 0;
}

/** Exported for the cron's dry run — how many people WOULD be emailed today. */
export async function digestAlreadySentToday(userId: string, today: string): Promise<boolean> {
  const row = await db.query.annualReportDigest.findFirst({
    where: and(
      eq(annualReportDigest.userId, userId),
      eq(annualReportDigest.lastDigestOn, today)
    ),
  });
  return !!row;
}
