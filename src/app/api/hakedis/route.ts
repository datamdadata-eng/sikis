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

/** Kayıtlı %: önce sales satırı, yoksa closer (tek liste için birleşik). */
function unifiedRate(userId: number, rateMap: Map<string, number>): number {
  const s = rateMap.get(`${userId}:sales`);
  const c = rateMap.get(`${userId}:closer`);
  if (s != null && s > 0) return s;
  if (c != null && c > 0) return c;
  return s ?? c ?? 0;
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

  const { rows: personRows } = await query<{ user_id: number; user_name: string; total_amount: string }>(
    `
    WITH line_amts AS (
      SELECT s.user_id AS uid, s.amount
      FROM sales s
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
        AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
        AND s.user_id IS NOT NULL
      UNION ALL
      SELECT s.closer_user_id AS uid, s.amount
      FROM sales s
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
        AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
        AND s.closer_user_id IS NOT NULL
    )
    SELECT u.id AS user_id, u.name AS user_name, COALESCE(SUM(l.amount), 0)::text AS total_amount
    FROM line_amts l
    INNER JOIN users u ON u.id = l.uid
    GROUP BY u.id, u.name
    ORDER BY SUM(l.amount) DESC NULLS LAST
    `,
    [weekStart, weekEnd]
  );

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

  const rateMap = new Map<string, number>();
  try {
    const rr = await query<{ user_id: number; role: string; rate_percent: string }>(
      `SELECT user_id, role, rate_percent::text FROM hakedis_week_user_rate WHERE week_start = $1::date`,
      [weekStart]
    );
    for (const row of rr.rows) {
      if (row.role === "sales" || row.role === "closer") {
        rateMap.set(`${row.user_id}:${row.role}`, Number(row.rate_percent));
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/hakedis_week_user_rate/i.test(msg) || !/does not exist/i.test(msg)) {
      console.error("[hakedis GET rates]", e);
    }
  }

  const people = personRows.map((row) => {
    const ciro = Number(row.total_amount);
    const rate = unifiedRate(row.user_id, rateMap);
    const hk = (ciro * rate) / 100;
    return {
      ...row,
      rate_percent: Number(rate.toFixed(2)),
      hakedis_try: hk.toFixed(2),
    };
  });

  return NextResponse.json({
    weekStart,
    weekEnd,
    weekOffset,
    people,
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
