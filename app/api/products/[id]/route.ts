import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { product } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parseBody, productUpdateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

async function loadOwnedProduct(id: string, organizationId: string) {
  const row = await db.query.product.findFirst({ where: eq(product.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_product_update", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const existing = await loadOwnedProduct(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const parsed = parseBody(productUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const updateData: Partial<typeof product.$inferInsert> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.sku !== undefined) updateData.sku = input.sku ?? null;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.unitPrice !== undefined) updateData.unitPrice = input.unitPrice;
    if (input.vatRate !== undefined) updateData.vatRate = String(input.vatRate);
    if (input.unit !== undefined) updateData.unit = input.unit ?? null;
    if (input.active !== undefined) updateData.active = input.active;

    const [updated] = await db
      .update(product)
      .set(updateData)
      .where(eq(product.id, existing.id))
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "product",
      entityId: updated.id,
      action: "updated",
      metadata: { name: updated.name },
    });

    return NextResponse.json({ product: updated });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const existing = await loadOwnedProduct(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Soft delete — existing quote/order lines keep their snapshot (productId set null).
    await db
      .update(product)
      .set({ deletedAt: new Date(), active: false })
      .where(eq(product.id, existing.id));

    await logActivity({
      userId,
      organizationId,
      entityType: "product",
      entityId: existing.id,
      action: "deleted",
      metadata: { name: existing.name },
    });

    return NextResponse.json({ message: "Product deleted" });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
