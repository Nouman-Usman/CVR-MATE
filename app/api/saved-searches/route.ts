import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { savedSearch } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { resolveWorkspaceForUser } from "@/lib/workspace/resolve";
import { workspaceScope } from "@/lib/workspace/scope";
import { orgIdForWrite } from "@/lib/workspace/types";

// GET /api/saved-searches — list saved searches for the current user
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await resolveWorkspaceForUser(
      session.user.id,
      session.session?.activeOrganizationId
    );

    // `createSavedSearch` in lib/saved-searches.ts already accepts an
    // organizationId, but this list filtered on userId alone — so a search
    // saved to a team followed its author into every workspace and was never
    // visible to the teammates it was shared with.
    const searches = await db.query.savedSearch.findMany({
      where: workspaceScope(workspace, {
        userId: savedSearch.userId,
        organizationId: savedSearch.organizationId,
      }),
      orderBy: (ss, { desc }) => [desc(ss.createdAt)],
    });

    return NextResponse.json({ results: searches });
  } catch (error) {
    console.error("Failed to fetch saved searches:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved searches" },
      { status: 500 }
    );
  }
}

// POST /api/saved-searches — save a new search
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, filters } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!filters || typeof filters !== "object") {
      return NextResponse.json(
        { error: "Filters are required" },
        { status: 400 }
      );
    }

    const workspace = await resolveWorkspaceForUser(
      session.user.id,
      session.session?.activeOrganizationId
    );

    const [created] = await db
      .insert(savedSearch)
      .values({
        userId: session.user.id,
        // Saved in the workspace the user is looking at: private in Personal,
        // shared with the team inside an organization.
        organizationId: orgIdForWrite(workspace),
        name: name.trim(),
        filters,
      })
      .returning();

    return NextResponse.json({ search: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to save search:", error);
    return NextResponse.json(
      { error: "Failed to save search" },
      { status: 500 }
    );
  }
}

// DELETE /api/saved-searches?id=xxx — remove a saved search
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    const workspace = await resolveWorkspaceForUser(
      session.user.id,
      session.session?.activeOrganizationId
    );

    const existing = await db.query.savedSearch.findFirst({
      where: eq(savedSearch.id, id),
    });

    /**
     * Deletable only from the workspace it lives in.
     *
     * A personal search stays the author's alone. A team search belongs to the
     * organization — a colleague can remove it, for the same reason they can
     * move a colleague's deal: shared means shared. Anything outside the active
     * workspace is 404 rather than 403, so the response never confirms that a
     * search exists in an organization the caller is not currently in.
     */
    const deletable =
      existing &&
      (workspace.type === "org"
        ? existing.organizationId === workspace.id
        : existing.organizationId === null && existing.userId === session.user.id);

    if (!deletable) {
      return NextResponse.json(
        { error: "Search not found" },
        { status: 404 }
      );
    }

    await db.delete(savedSearch).where(eq(savedSearch.id, id));

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("Failed to remove saved search:", error);
    return NextResponse.json(
      { error: "Failed to remove saved search" },
      { status: 500 }
    );
  }
}
