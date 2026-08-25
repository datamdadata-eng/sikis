import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipientId = Number(id);
  const body = await request.json().catch(() => ({}));
  const percentage = Number(body.defaultPercentage);
  if (!Number.isInteger(recipientId) || recipientId <= 0 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    await query(`ALTER TABLE money_recipients ADD COLUMN IF NOT EXISTS default_percentage NUMERIC(6,2) NOT NULL DEFAULT 0;`);
    const { rows } = await query<{ id: number }>(
      "UPDATE money_recipients SET default_percentage = $1 WHERE id = $2 RETURNING id",
      [percentage, recipientId]
    );
    if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
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
  const recipientId = Number(id);
  if (Number.isNaN(recipientId) || recipientId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  try {
    await query("DELETE FROM money_recipients WHERE id = $1", [recipientId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
