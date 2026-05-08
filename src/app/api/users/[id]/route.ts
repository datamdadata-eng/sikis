import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

function verifyBearer(request: Request): { id: number; username: string } | null {
  try {
    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) return null;
    const token = auth.slice("Bearer ".length);
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    return { id: decoded.id, username: decoded.username };
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = verifyBearer(request);
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (Number.isNaN(userId) || userId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.defaultHakedisPercent === undefined && body.default_hakedis_percent === undefined) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }
  const raw = body.defaultHakedisPercent ?? body.default_hakedis_percent;
  const pct = Number(raw);
  if (Number.isNaN(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ error: "invalid_default_hakedis_percent" }, { status: 400 });
  }

  try {
    await query(`UPDATE users SET default_hakedis_percent = $1 WHERE id = $2`, [pct, userId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/default_hakedis_percent/i.test(msg)) {
      return NextResponse.json(
        { error: "setup_required", message: "Bir kez POST /api/setup çalıştırın (default_hakedis_percent sütunu)." },
        { status: 503 }
      );
    }
    console.error("[users PATCH]", e);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);
  if (Number.isNaN(userId) || userId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  try {
    await query("DELETE FROM users WHERE id = $1", [userId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[users DELETE]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 });
  }
}
