import { NextRequest, NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import {
  followedPerson,
  personCompanyIndex,
  personRoleSnapshot,
} from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { checkUsageEntitlement } from "@/lib/stripe/entitlements";
import {
  getCompanyByVat,
  getParticipantByNumber,
  type CvrParticipation,
} from "@/lib/cvr-api";

// GET /api/followed-people — list followed people for the current user
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const followed = await db.query.followedPerson.findMany({
      where: and(
        eq(followedPerson.userId, session.user.id),
        eq(followedPerson.isActive, true)
      ),
      orderBy: (fp, { desc }) => [desc(fp.createdAt)],
    });

    return NextResponse.json({
      results: followed.map((f) => ({
        id: f.id,
        participantNumber: f.participantNumber,
        personName: f.personName,
        fromVat: f.fromVat ?? null,
        note: f.note,
        lastCheckedAt: f.lastCheckedAt?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch followed people:", error);
    return NextResponse.json(
      { error: "Failed to fetch followed people" },
      { status: 500 }
    );
  }
}

// POST /api/followed-people — follow a person (with backfill)
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check follow limit
    const [{ value: followCount }] = await db
      .select({ value: count() })
      .from(followedPerson)
      .where(
        and(
          eq(followedPerson.userId, session.user.id),
          eq(followedPerson.isActive, true)
        )
      );

    const { allowed, limit } = await checkUsageEntitlement(
      session.user.id,
      "followedPeople",
      followCount
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Follow limit reached (${limit}). Upgrade your plan for more.`,
          upgrade: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { participantNumber, personName, fromVat } = body;

    if (!participantNumber || !personName) {
      return NextResponse.json(
        { error: "participantNumber and personName are required" },
        { status: 400 }
      );
    }

    const pn = String(participantNumber);

    // Check if already followed
    const alreadyFollowed = await db.query.followedPerson.findFirst({
      where: and(
        eq(followedPerson.userId, session.user.id),
        eq(followedPerson.participantNumber, pn)
      ),
    });

    if (alreadyFollowed) {
      // Reactivate if soft-deactivated
      if (!alreadyFollowed.isActive) {
        await db
          .update(followedPerson)
          .set({ isActive: true })
          .where(eq(followedPerson.id, alreadyFollowed.id));
        return NextResponse.json({ followed: true, reactivated: true }, { status: 200 });
      }
      return NextResponse.json({ followed: true, alreadyFollowed: true });
    }

    // Insert follow record
    await db.insert(followedPerson).values({
      userId: session.user.id,
      participantNumber: pn,
      personName: String(personName),
      fromVat: fromVat ? String(fromVat) : null,
    });

    // ─── Backfill: build reverse index + initial snapshots ───
    // Run async — don't block the response for the user
    backfillPersonData(pn, fromVat ? String(fromVat) : undefined).catch(
      (err) => console.error("Backfill error for participant", pn, err)
    );

    return NextResponse.json({ followed: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to follow person:", error);
    return NextResponse.json(
      { error: "Failed to follow person" },
      { status: 500 }
    );
  }
}

// DELETE /api/followed-people — unfollow a person
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pn = req.nextUrl.searchParams.get("participantNumber");
    if (!pn) {
      return NextResponse.json(
        { error: "participantNumber parameter is required" },
        { status: 400 }
      );
    }

    // Delete the follow record
    await db
      .delete(followedPerson)
      .where(
        and(
          eq(followedPerson.userId, session.user.id),
          eq(followedPerson.participantNumber, pn)
        )
      );

    // Clean up shared data if no other users follow this participant
    const [{ value: othersFollowing }] = await db
      .select({ value: count() })
      .from(followedPerson)
      .where(eq(followedPerson.participantNumber, pn));

    if (othersFollowing === 0) {
      await db
        .delete(personCompanyIndex)
        .where(eq(personCompanyIndex.participantNumber, pn));
      await db
        .delete(personRoleSnapshot)
        .where(eq(personRoleSnapshot.participantNumber, pn));
    }

    return NextResponse.json({ unfollowed: true });
  } catch (error) {
    console.error("Failed to unfollow person:", error);
    return NextResponse.json(
      { error: "Failed to unfollow person" },
      { status: 500 }
    );
  }
}

// ─── Backfill helper ────────────────────────────────────────────────────────
// Populates personCompanyIndex + personRoleSnapshot when a user first follows someone.

async function backfillPersonData(
  participantNumber: string,
  fromVat?: string
) {
  // Check if already backfilled by another user
  const existingIndex = await db.query.personCompanyIndex.findFirst({
    where: eq(personCompanyIndex.participantNumber, participantNumber),
  });
  if (existingIndex) return; // Already has data from another follower

  let companies: CvrParticipation[] = [];

  // Get companies from the originating company (if provided)
  if (fromVat && /^\d{8}$/.test(fromVat)) {
    try {
      const companyData = await getCompanyByVat(Number(fromVat));
      const raw = companyData as unknown as Record<string, unknown>;
      const participations = (raw.participations ?? []) as CvrParticipation[];
      if (participations.length > 0) {
        companies = participations;
      }

      // Also add the originating company if this participant has roles there
      const participants = (raw.participants ?? []) as {
        participantnumber?: number;
        roles: CvrParticipation["roles"];
      }[];
      const thisParticipant = participants.find(
        (p) => p.participantnumber === Number(participantNumber)
      );
      if (thisParticipant) {
        const alreadyIncluded = companies.some(
          (c) => c.vat === Number(fromVat)
        );
        if (!alreadyIncluded) {
          companies.unshift({
            vat: companyData.vat,
            slug: companyData.slug,
            companyform: companyData.companyform,
            companystatus: companyData.companystatus,
            life: companyData.life,
            roles: thisParticipant.roles,
          });
        }
      }
    } catch (err) {
      console.error("Backfill: failed to fetch originating company", fromVat, err);
    }
  }

  // Also try participant endpoint directly for basic info
  try {
    await getParticipantByNumber(Number(participantNumber));
  } catch {
    // Non-critical — we just want to warm the cache
  }

  if (companies.length === 0) return;

  // Populate reverse index
  for (const c of companies) {
    try {
      await db
        .insert(personCompanyIndex)
        .values({
          participantNumber,
          companyVat: String(c.vat),
          companyName: c.life.name,
        })
        .onConflictDoNothing();
    } catch {
      // Ignore duplicates
    }
  }

  // Create initial snapshots
  for (const c of companies) {
    try {
      await db
        .insert(personRoleSnapshot)
        .values({
          participantNumber,
          companyVat: String(c.vat),
          rolesJson: c.roles.map((r) => ({
            type: r.type,
            start: r.life.start ?? null,
            end: r.life.end ?? null,
            title: r.life.title ?? null,
            owner_percent: r.life.owner_percent ?? null,
            owner_voting_percent: r.life.owner_voting_percent ?? null,
          })),
          companyName: c.life.name,
          companyStatus: c.companystatus?.text ?? null,
        })
        .onConflictDoNothing();
    } catch {
      // Ignore duplicates
    }
  }
}
