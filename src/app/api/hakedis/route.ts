import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type Frankfurter = { rates?: { TRY?: number }; date?: string };

async function fetchTryPerUsd(): Promise<{ tryPerUsd: number; fxDate: string | null; error?: string }> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { tryPerUsd: 0, fxDate: null, error: "fx_unavailable" };
    const data = (await res.json()) as Frankfurter;
    const tryPerUsd = data.rates?.TRY;
    if (!tryPerUsd || tryPerUsd <= 0) return { tryPerUsd: 0, fxDate: null, error: "fx_invalid" };
    return { tryPerUsd, fxDate: data.date ?? null };
  } catch {
    return { tryPerUsd: 0, fxDate: null, error: "fx_fetch_failed" };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekOffset = Math.min(52, Math.max(-52, parseInt(searchParams.get("weekOffset") || "0", 10) || 0));

  const { rows: boundRows } = await query<{ week_start: string; week_end: string }>(
    `
    WITH ref AS (
      SELECT ((NOW() AT TIME ZONE 'Europe/Istanbul')::date + ($1 * 7))::date AS d
    ),
    bounds AS (
      SELECT
        (d - ((EXTRACT(ISODOW FROM d))::int - 1) * interval '1 day')::date AS week_start,
        (d - ((EXTRACT(ISODOW FROM d))::int - 1) * interval '1 day' + interval '6 days')::date AS week_end
      FROM ref
    )
    SELECT week_start::text, week_end::text FROM bounds
    `,
    [weekOffset]
  );

  const weekStart = boundRows[0]?.week_start;
  const weekEnd = boundRows[0]?.week_end;
  if (!weekStart || !weekEnd) {
    return NextResponse.json({ error: "week_bounds" }, { status: 500 });
  }

  const [userRows, closerRows] = await Promise.all([
    query<{ user_id: number; user_name: string; total_amount: string }>(
      `
      SELECT u.id AS user_id, u.name AS user_name, COALESCE(SUM(s.amount), 0)::text AS total_amount
      FROM sales s
      INNER JOIN users u ON s.user_id = u.id
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
        AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
      GROUP BY u.id, u.name
      ORDER BY SUM(s.amount) DESC NULLS LAST
    `,
      [weekStart, weekEnd]
    ),
    query<{ closer_id: number; closer_name: string; total_amount: string }>(
      `
      SELECT u.id AS closer_id, u.name AS closer_name, COALESCE(SUM(s.amount), 0)::text AS total_amount
      FROM sales s
      INNER JOIN users u ON s.closer_user_id = u.id
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
        AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
      GROUP BY u.id, u.name
      ORDER BY SUM(s.amount) DESC NULLS LAST
    `,
      [weekStart, weekEnd]
    ),
  ]);

  const fx = await fetchTryPerUsd();

  return NextResponse.json({
    weekStart,
    weekEnd,
    weekOffset,
    users: userRows.rows,
    closers: closerRows.rows,
    tryPerUsd: fx.tryPerUsd,
    fxDate: fx.fxDate,
    fxError: fx.error ?? null,
  });
}
