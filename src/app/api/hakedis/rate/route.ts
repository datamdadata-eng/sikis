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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const admin = verifyBearer(request);
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const weekStart = String(body.weekStart ?? "").trim();
  const userId = Number(body.userId);
  const role = body.role === "closer" ? "closer" : "sales";
  const percentage = Number(body.percentage);

  if (!DATE_RE.test(weekStart)) {
    return NextResponse.json({ error: "invalid_week_start" }, { status: 400 });
  }
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  if (Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
    return NextResponse.json({ error: "invalid_percentage" }, { status: 400 });
  }

  try {
    await query(
      `
      INSERT INTO hakedis_week_user_rate (week_start, user_id, role, rate_percent)
      VALUES ($1::date, $2, $3, $4)
      ON CONFLICT (week_start, user_id, role)
      DO UPDATE SET rate_percent = EXCLUDED.rate_percent, updated_at = now()
    `,
      [weekStart, userId, role, percentage]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/hakedis_week_user_rate/i.test(msg) && /does not exist/i.test(msg)) {
      return NextResponse.json({ error: "table_missing_run_setup" }, { status: 503 });
    }
    console.error("[hakedis/rate POST]", e);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
