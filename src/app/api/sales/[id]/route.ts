import { NextResponse } from "next/server";
import { query } from "@/lib/db";

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
