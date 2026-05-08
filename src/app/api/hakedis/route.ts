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

  const salesTotalTry = userRows.rows.reduce((s, r) => s + Number(r.total_amount), 0);
  const closerTotalTry = closerRows.rows.reduce((s, r) => s + Number(r.total_amount), 0);

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
  let salesTotalPercent = 0;
  let closerTotalPercent = 0;

  try {
    const ex = await query<{
      week_total_percent: string;
      jin_percent: string;
      arsimet_percent: string;
      sales_total_percent: string;
      closer_total_percent: string;
    }>(
      `
      SELECT week_total_percent::text, jin_percent::text, arsimet_percent::text,
             sales_total_percent::text, closer_total_percent::text
      FROM hakedis_week_extras
      WHERE week_start = $1::date
    `,
      [weekStart]
    );
    if (ex.rows[0]) {
      weekTotalPercent = Number(ex.rows[0].week_total_percent);
      jinPercent = Number(ex.rows[0].jin_percent);
      arsimetPercent = Number(ex.rows[0].arsimet_percent);
      salesTotalPercent = Number(ex.rows[0].sales_total_percent);
      closerTotalPercent = Number(ex.rows[0].closer_total_percent);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/column "sales_total_percent"/i.test(msg) || /column "closer_total_percent"/i.test(msg)) {
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
      } catch (inner) {
        console.error("[hakedis GET extras legacy]", inner);
      }
    } else if (!/hakedis_week_extras/i.test(msg) || !/does not exist/i.test(msg)) {
      console.error("[hakedis GET extras]", e);
    }
  }

  const weekTotalNum = Number(weekTotalTry);
  const jinHakedisTry = (weekTotalNum * jinPercent) / 100;
  const arsimetHakedisTry = (weekTotalNum * arsimetPercent) / 100;
  const salesHakedisTry = (salesTotalTry * salesTotalPercent) / 100;
  const closerHakedisTry = (closerTotalTry * closerTotalPercent) / 100;

  return NextResponse.json({
    weekStart,
    weekEnd,
    weekOffset,
    users: [] as unknown[],
    closers: [] as unknown[],
    salesSummary: {
      total_amount: salesTotalTry.toFixed(2),
      percentage: salesTotalPercent,
      hakedis_try: salesHakedisTry.toFixed(2),
    },
    closerSummary: {
      total_amount: closerTotalTry.toFixed(2),
      percentage: closerTotalPercent,
      hakedis_try: closerHakedisTry.toFixed(2),
    },
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
