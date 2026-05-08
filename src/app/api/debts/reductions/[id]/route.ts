import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum) || idNum <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  try {
    await query("DELETE FROM debt_reductions WHERE id = $1", [idNum]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "debt_reductions" does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true });
    }
    console.error("[debt_reductions DELETE]", e);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
