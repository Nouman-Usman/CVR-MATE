import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { interaction, interactionAttachment } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse, CrmConflictError } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { assertCanMutateResource } from "@/lib/team/permissions";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  attachmentPath,
  attachmentStorage,
  safeDisplayName,
  DOWNLOAD_URL_TTL,
} from "@/lib/attachments/storage";

/** Load an interaction only if it belongs to the caller's org and is live. */
async function loadOwnedInteraction(id: string, organizationId: string) {
  const row = await db.query.interaction.findFirst({ where: eq(interaction.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

/**
 * GET /api/interactions/[id]/attachments
 *
 * Returns metadata plus a freshly minted, short-lived signed URL per file.
 * URLs are never stored: a persisted link would outlive the permission check
 * that produced it, so anyone who ever saw the response would keep access.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_attachments_read", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const owner = await loadOwnedInteraction(id, organizationId);
    if (!owner) return NextResponse.json({ error: "Interaction not found" }, { status: 404 });

    const rows = await db
      .select()
      .from(interactionAttachment)
      .where(
        and(
          eq(interactionAttachment.interactionId, id),
          eq(interactionAttachment.organizationId, organizationId),
          isNull(interactionAttachment.deletedAt)
        )
      )
      .orderBy(asc(interactionAttachment.createdAt));

    if (rows.length === 0) return NextResponse.json({ attachments: [] });

    const storage = attachmentStorage();
    const { data: signed, error } = await storage.createSignedUrls(
      rows.map((r) => r.storagePath),
      DOWNLOAD_URL_TTL
    );
    if (error) throw error;

    const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));

    return NextResponse.json({
      attachments: rows.map((r) => ({
        id: r.id,
        filename: r.filename,
        contentType: r.contentType,
        sizeBytes: r.sizeBytes,
        createdAt: r.createdAt,
        // Null when signing failed for this one object — the row still renders,
        // just without a working link, rather than failing the whole list.
        url: urlByPath.get(r.storagePath) ?? null,
      })),
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/**
 * POST /api/interactions/[id]/attachments
 *
 * Two-step upload, step one: validate and hand back a signed URL the browser
 * PUTs the bytes to directly. The file never passes through this server, which
 * keeps a 25 MB upload off the serverless request body limit.
 *
 * The path is generated here, never taken from the client — a client-controlled
 * path with `../` in it writes into another org's prefix.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_attachment_upload", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const owner = await loadOwnedInteraction(id, organizationId);
    if (!owner) return NextResponse.json({ error: "Interaction not found" }, { status: 404 });

    await assertCanMutateResource(userId, {
      userId: owner.createdBy ?? "",
      organizationId: owner.organizationId,
    });

    const body = (await req.json().catch(() => ({}))) as {
      filename?: unknown;
      contentType?: unknown;
      sizeBytes?: unknown;
    };

    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const filename = typeof body.filename === "string" ? body.filename : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : NaN;

    if (!filename.trim()) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }
    if (!(contentType in ALLOWED_CONTENT_TYPES)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${contentType || "(none)"}` },
        { status: 400 }
      );
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: "sizeBytes must be a positive number" }, { status: 400 });
    }
    if (sizeBytes > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large. The limit is ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.`,
        },
        { status: 400 }
      );
    }

    const storagePath = attachmentPath(organizationId, id, contentType);
    const storage = attachmentStorage();
    const { data, error } = await storage.createSignedUploadUrl(storagePath);
    if (error) throw error;

    // The row is written now, before the bytes land, so a client that uploads
    // and then dies still leaves a record an operator can see and clean up.
    // The reverse order would leave orphaned objects nothing references.
    const [row] = await db
      .insert(interactionAttachment)
      .values({
        organizationId,
        interactionId: id,
        storagePath,
        filename: safeDisplayName(filename),
        contentType,
        sizeBytes,
        uploadedBy: userId,
      })
      .returning();

    if (!row) throw new CrmConflictError("Could not register the attachment.");

    await logActivity({
      userId,
      organizationId,
      entityType: "interaction",
      entityId: id,
      action: "updated",
      metadata: { companyId: owner.companyId, attachment: row.filename },
    });

    return NextResponse.json(
      {
        attachment: {
          id: row.id,
          filename: row.filename,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          createdAt: row.createdAt,
        },
        uploadUrl: data?.signedUrl,
        token: data?.token,
        path: storagePath,
      },
      { status: 201 }
    );
  } catch (err) {
    return crmErrorResponse(err);
  }
}
