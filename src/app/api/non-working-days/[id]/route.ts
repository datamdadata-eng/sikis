import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  await query("DELETE FROM non_working_days WHERE id = $1", [idNum]);
  return NextResponse.json({ ok: true });
}
