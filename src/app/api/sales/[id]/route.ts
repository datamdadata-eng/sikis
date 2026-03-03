import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const saleId = Number(id);
  if (Number.isNaN(saleId) || saleId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const { amount, status, recipientId } = body;

  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;

  if (amount !== undefined) {
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }
    updates.push(`amount = $${idx++}`);
    values.push(parsed);
  }
  if (status !== undefined) {
    if (status !== "onay" && status !== "patladi") {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    updates.push(`status = $${idx++}`);
    values.push(status);
  }
  if (recipientId !== undefined) {
    updates.push(`recipient_id = $${idx++}`);
    values.push(recipientId === "" || recipientId === null ? null : Number(recipientId));
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  values.push(saleId);
  try {
    await query(
      `UPDATE sales SET ${updates.join(", ")} WHERE id = $${idx}`,
      values
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const saleId = Number(id);
  if (Number.isNaN(saleId) || saleId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  try {
    await query("DELETE FROM sales WHERE id = $1", [saleId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
