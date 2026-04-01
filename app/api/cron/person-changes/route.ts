import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import {
  changeFeedCursor,
  followedPerson,
  personCompanyIndex,
  personRoleSnapshot,
  personRoleEvent,
} from "@/db/schema";
import { db } from "@/db";
import { getChangedCompanies, getCompanyByVatFresh } from "@/lib/cvr-api";
import { createNotification } from "@/lib/notifications";
import { verifyQStashRequest } from "@/lib/qstash";
import {
  diffRoles,
  diffCompanyStatus,
  computeEventHash,
  extractRoles,
  type SnapshotRole,
  type RoleChange,
} from "@/lib/person-changes";

// Cron endpoint: polls CVR company change feed, diffs participant roles, sends notifications.
// Scheduled via Upstash QStash every 12 hours (0 */12 * * *).
// Secured via QStash signature (production) or CRON_SECRET Bearer token (local/manual).

const BATCH_SIZE = 5;
const MAX_CHANGES_PER_RUN = 5000;
const STALE_LOCK_MS = 30 * 60 * 1000; // 30 minutes

async function verifyAuth(req: NextRequest): Promise<boolean> {
  if (await verifyQStashRequest(req)) return true;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

// ─── Acquire processing lock via Postgres ───────────────────────────────────

async function acquireLock(): Promise<{
  acquired: boolean;
  cursor: { id: string; lastChangeId: string } | null;
}> {
  const now = new Date();

  // Get or create cursor
  const cursor = await db.query.changeFeedCursor.findFirst({
    where: eq(changeFeedCursor.feedType, "company"),
  });

  if (!cursor) {
    // Initialize cursor — start from 0 (will fetch latest changes)
    const [created] = await db
      .insert(changeFeedCursor)
      .values({
        feedType: "company",
        lastChangeId: "0",
        isProcessing: true,
        processingStartedAt: now,
      })
      .returning();
    return { acquired: true, cursor: { id: created.id, lastChangeId: "0" } };
  }

  // Check if already processing (with stale lock detection)
  if (cursor.isProcessing) {
    const startedAt = cursor.processingStartedAt;
    if (startedAt && now.getTime() - startedAt.getTime() < STALE_LOCK_MS) {
      return { acquired: false, cursor: null };
    }
    // Stale lock — take over
  }

  // Acquire lock
  await db
    .update(changeFeedCursor)
    .set({ isProcessing: true, processingStartedAt: now })
    .where(eq(changeFeedCursor.id, cursor.id));

  return {
    acquired: true,
    cursor: { id: cursor.id, lastChangeId: cursor.lastChangeId },
  };
}

async function releaseLock(cursorId: string, newChangeId?: string) {
  const updates: Record<string, unknown> = {
    isProcessing: false,
    processingStartedAt: null,
    processedAt: new Date(),
  };
  if (newChangeId) updates.lastChangeId = newChangeId;

  await db
    .update(changeFeedCursor)
    .set(updates)
    .where(eq(changeFeedCursor.id, cursorId));
}

// ─── Core processing logic ──────────────────────────────────────────────────

async function processPersonChanges() {
  const { acquired, cursor } = await acquireLock();

  if (!acquired || !cursor) {
    return NextResponse.json({
      skipped: true,
      reason: "Another worker is processing",
    });
  }

  try {
    // Step 1: Poll change feed
    let changedEntries = await getChangedCompanies(
      Number(cursor.lastChangeId)
    );

    if (!Array.isArray(changedEntries) || changedEntries.length === 0) {
      await releaseLock(cursor.id);
      return NextResponse.json({
        processed: 0,
        message: "No changes since last check",
        timestamp: new Date().toISOString(),
      });
    }

    // Cap to prevent runaway processing
    changedEntries = changedEntries.slice(0, MAX_CHANGES_PER_RUN);
    const maxChangeId = Math.max(...changedEntries.map((e) => e.change_id));

    // Step 2: Filter to relevant VATs via reverse index
    const changedVats = [...new Set(changedEntries.map((e) => String(e.vat)))];

    const relevantIndexRows = await db
      .select({
        participantNumber: personCompanyIndex.participantNumber,
        companyVat: personCompanyIndex.companyVat,
      })
      .from(personCompanyIndex)
      .where(inArray(personCompanyIndex.companyVat, changedVats));

    if (relevantIndexRows.length === 0) {
      await releaseLock(cursor.id, String(maxChangeId));
      return NextResponse.json({
        processed: 0,
        changedCompanies: changedVats.length,
        relevantCompanies: 0,
        message: "No tracked participants in changed companies",
        timestamp: new Date().toISOString(),
      });
    }

    // Group by VAT for processing
    const vatToParticipants = new Map<string, string[]>();
    for (const row of relevantIndexRows) {
      const existing = vatToParticipants.get(row.companyVat) ?? [];
      existing.push(row.participantNumber);
      vatToParticipants.set(row.companyVat, existing);
    }

    const relevantVats = [...vatToParticipants.keys()];
    const allChanges: RoleChange[] = [];
    const errors: { vat: string; error: string }[] = [];

    // Step 3: Fetch and process in batches
    for (let i = 0; i < relevantVats.length; i += BATCH_SIZE) {
      const batch = relevantVats.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((vat) => processCompanyForChanges(vat, vatToParticipants))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          allChanges.push(...result.value);
        } else {
          errors.push({
            vat: batch[j],
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Unknown error",
          });
        }
      }
    }

    // Step 4: Store events + send notifications
    let eventsCreated = 0;
    let notificationsSent = 0;

    for (const change of allChanges) {
      const hash = computeEventHash(change);

      // Insert event (dedup via unique hash)
      try {
        await db
          .insert(personRoleEvent)
          .values({
            participantNumber: change.participantNumber,
            companyVat: change.companyVat,
            companyName: change.companyName,
            personName: change.personName,
            eventType: change.eventType,
            eventCategory: change.eventCategory,
            role: change.role as Record<string, unknown> | null,
            previousValue: change.previousValue,
            newValue: change.newValue,
            importance: change.importance,
            eventHash: hash,
          })
          .onConflictDoNothing();
        eventsCreated++;
      } catch {
        // Duplicate hash — already processed, skip notification
        continue;
      }

      // Send notifications to all followers of this participant
      const followers = await db.query.followedPerson.findMany({
        where: and(
          eq(followedPerson.participantNumber, change.participantNumber),
          eq(followedPerson.isActive, true)
        ),
      });

      for (const follower of followers) {
        try {
          await createNotification({
            userId: follower.userId,
            type: "person_follow",
            title: formatEventTitle(change),
            message: formatEventMessage(change),
            link: `/person/${change.participantNumber}`,
          });
          notificationsSent++;
        } catch (err) {
          console.error(
            `Failed to notify user ${follower.userId} about change:`,
            err
          );
        }
      }

      // Update lastCheckedAt for followers
      if (followers.length > 0) {
        const followerIds = followers.map((f) => f.id);
        await db
          .update(followedPerson)
          .set({ lastCheckedAt: new Date() })
          .where(inArray(followedPerson.id, followerIds));
      }
    }

    // Step 5: Update cursor
    await releaseLock(cursor.id, String(maxChangeId));

    return NextResponse.json({
      processed: relevantVats.length,
      changedCompanies: changedVats.length,
      relevantCompanies: relevantVats.length,
      eventsDetected: allChanges.length,
      eventsCreated,
      notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Person change cron failed:", error);
    // Release lock on error
    await releaseLock(cursor.id).catch(() => {});
    return NextResponse.json(
      { error: "Cron execution failed" },
      { status: 500 }
    );
  }
}

// ─── Process a single company for participant changes ───────────────────────

async function processCompanyForChanges(
  vat: string,
  vatToParticipants: Map<string, string[]>
): Promise<RoleChange[]> {
  const company = await getCompanyByVatFresh(Number(vat));
  const raw = company as unknown as Record<string, unknown>;
  const participants = (raw.participants ?? []) as {
    participantnumber?: number;
    life?: { name?: string };
    roles: { type: string; life: Record<string, unknown> }[];
  }[];

  const trackedPNs = new Set(vatToParticipants.get(vat) ?? []);
  const changes: RoleChange[] = [];

  for (const participant of participants) {
    const pn = String(participant.participantnumber);
    if (!trackedPNs.has(pn)) continue;

    const personName = participant.life?.name ?? "Unknown";
    const companyName = company.life?.name ?? "";
    const context = {
      participantNumber: pn,
      personName,
      companyVat: vat,
      companyName,
    };

    // Get existing snapshot
    const snapshot = await db.query.personRoleSnapshot.findFirst({
      where: and(
        eq(personRoleSnapshot.participantNumber, pn),
        eq(personRoleSnapshot.companyVat, vat)
      ),
    });

    const newRoles = extractRoles(participant.roles);
    const oldRoles = (snapshot?.rolesJson as SnapshotRole[]) ?? [];

    // Diff roles
    const roleChanges = diffRoles(oldRoles, newRoles, context);
    changes.push(...roleChanges);

    // Diff company-level status
    const newStatus = company.companystatus?.text ?? null;
    const newBankrupt = company.status?.bankrupt ?? false;
    const companyChanges = diffCompanyStatus(
      snapshot?.companyStatus ?? null,
      newStatus,
      snapshot?.companyBankrupt ?? false,
      newBankrupt,
      context
    );
    changes.push(...companyChanges);

    // Update snapshot (upsert)
    if (snapshot) {
      await db
        .update(personRoleSnapshot)
        .set({
          rolesJson: newRoles,
          companyName,
          companyStatus: newStatus,
          companyBankrupt: newBankrupt,
          companyIndustry: company.industry?.primary?.text ?? null,
          snapshotAt: new Date(),
        })
        .where(eq(personRoleSnapshot.id, snapshot.id));
    } else {
      await db
        .insert(personRoleSnapshot)
        .values({
          participantNumber: pn,
          companyVat: vat,
          rolesJson: newRoles,
          companyName,
          companyStatus: newStatus,
          companyBankrupt: newBankrupt,
          companyIndustry: company.industry?.primary?.text ?? null,
        })
        .onConflictDoNothing();
    }
  }

  // Self-healing index: check if any followed participant appeared in a NEW company
  const allFollowedPNs = await db
    .select({ participantNumber: followedPerson.participantNumber })
    .from(followedPerson)
    .where(eq(followedPerson.isActive, true));

  const followedSet = new Set(allFollowedPNs.map((f) => f.participantNumber));

  for (const participant of participants) {
    const pn = String(participant.participantnumber);
    if (!followedSet.has(pn)) continue;
    if (trackedPNs.has(pn)) continue; // Already in index

    // New association detected — add to index
    try {
      await db
        .insert(personCompanyIndex)
        .values({
          participantNumber: pn,
          companyVat: vat,
          companyName: company.life?.name ?? null,
        })
        .onConflictDoNothing();
    } catch {
      // Ignore
    }
  }

  return changes;
}

// ─── Notification formatting ────────────────────────────────────────────────

function formatEventTitle(change: RoleChange): string {
  switch (change.eventType) {
    case "role_added":
      return `${change.personName}: new role at ${change.companyName}`;
    case "role_removed":
      return `${change.personName}: role ended at ${change.companyName}`;
    case "role_updated":
      return `${change.personName}: role updated at ${change.companyName}`;
    case "company_status_changed":
      return `${change.companyName}: status changed`;
    case "company_bankrupt":
      return `${change.companyName}: declared bankrupt`;
    default:
      return `Change detected for ${change.personName}`;
  }
}

function formatEventMessage(change: RoleChange): string {
  const role = change.role;
  switch (change.eventType) {
    case "role_added":
      return `Gained ${role?.type ?? "role"}${role?.title ? ` (${role.title})` : ""}`;
    case "role_removed":
      return `Lost ${role?.type ?? "role"}${role?.title ? ` (${role.title})` : ""}`;
    case "role_updated": {
      const fields =
        (change.newValue?.changedFields as string[]) ?? [];
      return `${role?.type ?? "Role"} updated: ${fields.join(", ")}`;
    }
    case "company_status_changed":
      return `Status: ${change.previousValue?.status ?? "?"} → ${change.newValue?.status ?? "?"}`;
    case "company_bankrupt":
      return `Company has been declared bankrupt`;
    default:
      return "Change detected";
  }
}

// POST: Called by QStash in production
export async function POST(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return processPersonChanges();
}

// GET: For manual testing
export async function GET(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return processPersonChanges();
}
