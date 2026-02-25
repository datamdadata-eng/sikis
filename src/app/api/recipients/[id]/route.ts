import { NextResponse } from "next/server";
import { query } from "@/lib/db";

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
