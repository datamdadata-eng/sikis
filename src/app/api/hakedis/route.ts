import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/** Her istekte güncel kur (önbellek yok). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Frankfurter = { rates?: { TRY?: number }; date?: string };

async function fetchTryPerUsd(): Promise<{ tryPerUsd: number; fxDate: string | null; error?: string }> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY", {
      cache: "no-store",
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

  let rateRows: { user_id: number; role: string; rate_percent: string }[] = [];
  try {
    const r = await query<{ user_id: number; role: string; rate_percent: string }>(
      `
      SELECT user_id, role, rate_percent::text AS rate_percent
      FROM hakedis_week_user_rate
      WHERE week_start = $1::date
    `,
      [weekStart]
    );
    rateRows = r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/hakedis_week_user_rate/i.test(msg) || !/does not exist/i.test(msg)) {
      console.error("[hakedis GET rates]", e);
    }
  }

  const rateMap = new Map<string, number>();
  for (const row of rateRows) {
    rateMap.set(`${row.user_id}:${row.role}`, Number(row.rate_percent));
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

  let weekTotalTry = "0";
  try {
    const wt = await query<{ t: string }>(
      `
      SELECT COALESCE(SUM(s.amount), 0)::text AS t
      FROM sales s
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
        AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
    `,
      [weekStart, weekEnd]
    );
    weekTotalTry = wt.rows[0]?.t ?? "0";
  } catch (e) {
    console.error("[hakedis GET week total]", e);
  }

  let weekTotalPercent = 0;
  let jinPercent = 0;
  let arsimetPercent = 0;

  try {
    const ex = await query<{
      week_total_percent: string;
      jin_percent: string;
      arsimet_percent: string;
    }>(
      `
      SELECT week_total_percent::text, jin_percent::text, arsimet_percent::text
      FROM hakedis_week_extras
      WHERE week_start = $1::date
    `,
      [weekStart]
    );
    if (ex.rows[0]) {
      weekTotalPercent = Number(ex.rows[0].week_total_percent);
      jinPercent = Number(ex.rows[0].jin_percent);
      arsimetPercent = Number(ex.rows[0].arsimet_percent);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/hakedis_week_extras/i.test(msg) || !/does not exist/i.test(msg)) {
      console.error("[hakedis GET extras]", e);
    }
  }

  const weekTotalNum = Number(weekTotalTry);
  const jinHakedisTry = (weekTotalNum * jinPercent) / 100;
  const arsimetHakedisTry = (weekTotalNum * arsimetPercent) / 100;

  const users = userRows.rows.map((row) => {
    const total = Number(row.total_amount);
    const percentage = rateMap.get(`${row.user_id}:sales`) ?? 0;
    const hakedisTry = (total * percentage) / 100;
    return {
      ...row,
      percentage,
      hakedis_try: hakedisTry.toFixed(2),
    };
  });

  const closers = closerRows.rows.map((row) => {
    const total = Number(row.total_amount);
    const percentage = rateMap.get(`${row.closer_id}:closer`) ?? 0;
    const hakedisTry = (total * percentage) / 100;
    return {
      ...row,
      percentage,
      hakedis_try: hakedisTry.toFixed(2),
    };
  });

  return NextResponse.json({
    weekStart,
    weekEnd,
    weekOffset,
    users,
    closers,
    extras: {
      weekTotalTry,
      weekTotalPercent,
      jinPercent,
      arsimetPercent,
      jinHakedisTry: jinHakedisTry.toFixed(2),
      arsimetHakedisTry: arsimetHakedisTry.toFixed(2),
    },
    tryPerUsd: fx.tryPerUsd,
    fxDate: fx.fxDate,
    fxError: fx.error ?? null,
  });
}
