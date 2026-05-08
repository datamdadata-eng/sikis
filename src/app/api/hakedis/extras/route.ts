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

function clampPct(n: number, max = 100): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > max) return max;
  return n;
}

type ExtrasRow = {
  week_total_percent: string;
  jin_percent: string;
  arsimet_percent: string;
  sales_total_percent: string;
  closer_total_percent: string;
};

export async function POST(request: Request) {
  const admin = verifyBearer(request);
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const weekStart = String(body.weekStart ?? "").trim();

  if (!DATE_RE.test(weekStart)) {
    return NextResponse.json({ error: "invalid_week_start" }, { status: 400 });
  }

  const hasWeekTotal = body.weekTotalPercent !== undefined && body.weekTotalPercent !== null;
  const hasJin = body.jinPercent !== undefined && body.jinPercent !== null;
  const hasArsimet = body.arsimetPercent !== undefined && body.arsimetPercent !== null;
  const hasSalesTotal = body.salesTotalPercent !== undefined && body.salesTotalPercent !== null;
  const hasCloserTotal = body.closerTotalPercent !== undefined && body.closerTotalPercent !== null;

  if (!hasWeekTotal && !hasJin && !hasArsimet && !hasSalesTotal && !hasCloserTotal) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  let weekTotalPercent = 0;
  let jinPercent = 0;
  let arsimetPercent = 0;
  let salesTotalPercent = 0;
  let closerTotalPercent = 0;

  try {
    const cur = await query<ExtrasRow>(
      `SELECT week_total_percent::text, jin_percent::text, arsimet_percent::text,
              sales_total_percent::text, closer_total_percent::text
       FROM hakedis_week_extras WHERE week_start = $1::date`,
      [weekStart]
    );
    if (cur.rows[0]) {
      weekTotalPercent = Number(cur.rows[0].week_total_percent);
      jinPercent = Number(cur.rows[0].jin_percent);
      arsimetPercent = Number(cur.rows[0].arsimet_percent);
      salesTotalPercent = Number(cur.rows[0].sales_total_percent);
      closerTotalPercent = Number(cur.rows[0].closer_total_percent);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/hakedis_week_extras/i.test(msg) && /does not exist/i.test(msg)) {
      return NextResponse.json({ error: "table_missing_run_setup" }, { status: 503 });
    }
    if (/column "sales_total_percent"/i.test(msg) || /column "closer_total_percent"/i.test(msg)) {
      return NextResponse.json(
        { error: "setup_required", message: "Bir kez POST /api/setup çalıştırın (satış/kapatıcı toplam % sütunları)." },
        { status: 503 }
      );
    }
    console.error("[hakedis/extras read]", e);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  if (hasWeekTotal) {
    weekTotalPercent = clampPct(Number(body.weekTotalPercent), 100);
  }
  if (hasJin) {
    jinPercent = clampPct(Number(body.jinPercent), 100);
  }
  if (hasArsimet) {
    arsimetPercent = clampPct(Number(body.arsimetPercent), 100);
  }
  if (hasSalesTotal) {
    salesTotalPercent = clampPct(Number(body.salesTotalPercent), 100);
  }
  if (hasCloserTotal) {
    closerTotalPercent = clampPct(Number(body.closerTotalPercent), 100);
  }

  try {
    await query(
      `
      INSERT INTO hakedis_week_extras (
        week_start, week_total_percent, jin_percent, arsimet_percent,
        sales_total_percent, closer_total_percent
      )
      VALUES ($1::date, $2, $3, $4, $5, $6)
      ON CONFLICT (week_start) DO UPDATE SET
        week_total_percent = $2,
        jin_percent = $3,
        arsimet_percent = $4,
        sales_total_percent = $5,
        closer_total_percent = $6,
        updated_at = now()
    `,
      [weekStart, weekTotalPercent, jinPercent, arsimetPercent, salesTotalPercent, closerTotalPercent]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/hakedis_week_extras/i.test(msg) && /does not exist/i.test(msg)) {
      return NextResponse.json({ error: "table_missing_run_setup" }, { status: 503 });
    }
    if (/column "sales_total_percent"/i.test(msg) || /column "closer_total_percent"/i.test(msg)) {
      return NextResponse.json(
        { error: "setup_required", message: "Bir kez POST /api/setup çalıştırın." },
        { status: 503 }
      );
    }
    console.error("[hakedis/extras POST]", e);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
