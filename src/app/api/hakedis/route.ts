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

function splitPool(
  rows: { total_amount: string }[],
  grand: number,
  pool: number
): { share_percent: number; hakedis_try: string }[] {
  if (grand <= 0 || rows.length === 0) {
    return rows.map(() => ({ share_percent: 0, hakedis_try: "0.00" }));
  }
  return rows.map((row) => {
    const amt = Number(row.total_amount);
    const share = (100 * amt) / grand;
    const hk = (pool * amt) / grand;
    return { share_percent: Number(share.toFixed(4)), hakedis_try: hk.toFixed(2) };
  });
}

/** Kişi başı kayıtlı ağırlık % ile havuz bölünür; ağırlık toplamı 0 ise ciroya göre bölünür. */
function splitByRatesOrCiro<R extends { total_amount: string }>(
  rows: R[],
  pool: number,
  role: "sales" | "closer",
  getId: (row: R) => number,
  rateMap: Map<string, number>
): { share_percent: number; hakedis_try: string; rate_percent: number }[] {
  if (rows.length === 0) return [];
  const rates = rows.map((row) => {
    const id = getId(row);
    return rateMap.get(`${id}:${role}`) ?? 0;
  });
  const sumR = rates.reduce((a, b) => a + b, 0);
  if (sumR <= 0) {
    const grand = rows.reduce((s, r) => s + Number(r.total_amount), 0);
    const ciro = splitPool(rows, grand, pool);
    return rows.map((_, i) => ({
      share_percent: ciro[i]?.share_percent ?? 0,
      hakedis_try: ciro[i]?.hakedis_try ?? "0.00",
      rate_percent: Number((rates[i] ?? 0).toFixed(2)),
    }));
  }
  return rows.map((_, i) => {
    const rate = rates[i] ?? 0;
    const share = (100 * rate) / sumR;
    const hk = (pool * rate) / sumR;
    return {
      share_percent: Number(share.toFixed(4)),
      hakedis_try: hk.toFixed(2),
      rate_percent: Number(rate.toFixed(2)),
    };
  });
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
  let salesHakedisPoolTry = 0;
  let closerHakedisPoolTry = 0;

  try {
    const ex = await query<{
      week_total_percent: string;
      jin_percent: string;
      arsimet_percent: string;
      sales_hakedis_pool_try: string;
      closer_hakedis_pool_try: string;
    }>(
      `
      SELECT week_total_percent::text, jin_percent::text, arsimet_percent::text,
             sales_hakedis_pool_try::text, closer_hakedis_pool_try::text
      FROM hakedis_week_extras
      WHERE week_start = $1::date
    `,
      [weekStart]
    );
    if (ex.rows[0]) {
      weekTotalPercent = Number(ex.rows[0].week_total_percent);
      jinPercent = Number(ex.rows[0].jin_percent);
      arsimetPercent = Number(ex.rows[0].arsimet_percent);
      salesHakedisPoolTry = Number(ex.rows[0].sales_hakedis_pool_try);
      closerHakedisPoolTry = Number(ex.rows[0].closer_hakedis_pool_try);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/sales_hakedis_pool_try/i.test(msg) || /closer_hakedis_pool_try/i.test(msg)) {
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

  const salesSplits = splitByRatesOrCiro(userRows.rows, salesHakedisPoolTry, "sales", (r) => r.user_id, rateMap);
  const closerSplits = splitByRatesOrCiro(closerRows.rows, closerHakedisPoolTry, "closer", (r) => r.closer_id, rateMap);

  const users = userRows.rows.map((row, i) => ({
    ...row,
    rate_percent: salesSplits[i]?.rate_percent ?? 0,
    share_percent: salesSplits[i]?.share_percent ?? 0,
    hakedis_try: salesSplits[i]?.hakedis_try ?? "0.00",
  }));

  const closers = closerRows.rows.map((row, i) => ({
    ...row,
    rate_percent: closerSplits[i]?.rate_percent ?? 0,
    share_percent: closerSplits[i]?.share_percent ?? 0,
    hakedis_try: closerSplits[i]?.hakedis_try ?? "0.00",
  }));

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
      salesHakedisPoolTry: salesHakedisPoolTry.toFixed(2),
      closerHakedisPoolTry: closerHakedisPoolTry.toFixed(2),
    },
    tryPerUsd: fx.tryPerUsd,
    fxDate: fx.fxDate,
    fxError: fx.error ?? null,
  });
}
