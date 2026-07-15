import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { fetchTryPerUsd } from "@/lib/frankfurter";

/** Her istekte güncel kur (önbellek yok). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function ensureDailyExtrasTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS hakedis_day_extras (
      day_date DATE NOT NULL PRIMARY KEY,
      week_total_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
      jin_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
      arsimet_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
      sales_hakedis_pool_try NUMERIC(14,2) NOT NULL DEFAULT 0,
      closer_hakedis_pool_try NUMERIC(14,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayOffset = Math.min(366, Math.max(-366, parseInt(searchParams.get("dayOffset") || searchParams.get("weekOffset") || "0", 10) || 0));

  const { rows: boundRows } = await query<{ day_date: string }>(
    `
    SELECT (((NOW() AT TIME ZONE 'Europe/Istanbul')::date + $1::int))::text AS day_date
    `,
    [dayOffset]
  );

  const dayDate = boundRows[0]?.day_date;
  if (!dayDate) {
    return NextResponse.json({ error: "day_bounds" }, { status: 500 });
  }

  let personRows: {
    user_id: number;
    user_name: string;
    total_amount: string;
    hakedis_base_amount: string;
    default_hakedis_percent: string;
  }[] = [];
  try {
    const pr = await query<{
      user_id: number;
      user_name: string;
      total_amount: string;
      hakedis_base_amount: string;
      default_hakedis_percent: string;
    }>(
      `
      WITH contrib AS (
        SELECT
          u.id AS user_id,
          u.name AS user_name,
          u.default_hakedis_percent,
          SUM(
            CASE
              WHEN s.user_id IS NOT NULL
                   AND s.closer_user_id IS NOT NULL
                   AND s.user_id = s.closer_user_id
                   AND u.id = s.user_id
                THEN s.amount
              WHEN s.user_id = u.id
                   AND (s.closer_user_id IS NULL OR s.closer_user_id IS DISTINCT FROM s.user_id)
                THEN s.amount
              WHEN s.closer_user_id = u.id AND s.user_id IS DISTINCT FROM s.closer_user_id
                THEN s.amount
              ELSE 0
            END
          ) AS amt_display,
          SUM(
            CASE
              WHEN s.user_id IS NOT NULL
                   AND s.closer_user_id IS NOT NULL
                   AND s.user_id = s.closer_user_id
                   AND u.id = s.user_id
                THEN 2 * s.amount
              WHEN s.user_id = u.id
                   AND (s.closer_user_id IS NULL OR s.closer_user_id IS DISTINCT FROM s.user_id)
                THEN s.amount
              WHEN s.closer_user_id = u.id AND s.user_id IS DISTINCT FROM s.closer_user_id
                THEN s.amount
              ELSE 0
            END
          ) AS amt_hakedis
        FROM sales s
        INNER JOIN users u ON u.id = s.user_id OR u.id = s.closer_user_id
        WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1::date
        GROUP BY u.id, u.name, u.default_hakedis_percent
      )
      SELECT c.user_id, c.user_name, c.amt_display::text AS total_amount,
             c.amt_hakedis::text AS hakedis_base_amount,
             COALESCE(c.default_hakedis_percent, 0)::text AS default_hakedis_percent
      FROM contrib c
      WHERE c.amt_display > 0
      ORDER BY c.amt_display DESC NULLS LAST
      `,
      [dayDate]
    );
    personRows = pr.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/default_hakedis_percent/i.test(msg)) {
      const pr = await query<{
        user_id: number;
        user_name: string;
        total_amount: string;
        hakedis_base_amount: string;
      }>(
        `
        WITH contrib AS (
          SELECT
            u.id AS user_id,
            u.name AS user_name,
            SUM(
              CASE
                WHEN s.user_id IS NOT NULL
                     AND s.closer_user_id IS NOT NULL
                     AND s.user_id = s.closer_user_id
                     AND u.id = s.user_id
                  THEN s.amount
                WHEN s.user_id = u.id
                     AND (s.closer_user_id IS NULL OR s.closer_user_id IS DISTINCT FROM s.user_id)
                  THEN s.amount
                WHEN s.closer_user_id = u.id AND s.user_id IS DISTINCT FROM s.closer_user_id
                  THEN s.amount
                ELSE 0
              END
            ) AS amt_display,
            SUM(
              CASE
                WHEN s.user_id IS NOT NULL
                     AND s.closer_user_id IS NOT NULL
                     AND s.user_id = s.closer_user_id
                     AND u.id = s.user_id
                  THEN 2 * s.amount
                WHEN s.user_id = u.id
                     AND (s.closer_user_id IS NULL OR s.closer_user_id IS DISTINCT FROM s.user_id)
                  THEN s.amount
                WHEN s.closer_user_id = u.id AND s.user_id IS DISTINCT FROM s.closer_user_id
                  THEN s.amount
                ELSE 0
              END
            ) AS amt_hakedis
          FROM sales s
          INNER JOIN users u ON u.id = s.user_id OR u.id = s.closer_user_id
          WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1::date
          GROUP BY u.id, u.name
        )
        SELECT c.user_id, c.user_name, c.amt_display::text AS total_amount,
               c.amt_hakedis::text AS hakedis_base_amount
        FROM contrib c
        WHERE c.amt_display > 0
        ORDER BY c.amt_display DESC NULLS LAST
        `,
        [dayDate]
      );
      personRows = pr.rows.map((r) => ({ ...r, default_hakedis_percent: "0" }));
    } else {
      console.error("[hakedis GET people]", e);
      return NextResponse.json({ error: "people_query_failed" }, { status: 500 });
    }
  }

  const fx = await fetchTryPerUsd();

  let weekTotalTry = "0";
  try {
    const wt = await query<{ t: string }>(
      `
      SELECT COALESCE(SUM(s.amount), 0)::text AS t
      FROM sales s
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1::date
    `,
      [dayDate]
    );
    weekTotalTry = wt.rows[0]?.t ?? "0";
  } catch (e) {
    console.error("[hakedis GET day total]", e);
  }

  let weekTotalPercent = 0;
  let jinPercent = 0;
  let arsimetPercent = 0;

  try {
    await ensureDailyExtrasTable();
    const ex = await query<{
      week_total_percent: string;
      jin_percent: string;
      arsimet_percent: string;
    }>(
      `
      SELECT week_total_percent::text, jin_percent::text, arsimet_percent::text
      FROM hakedis_day_extras
      WHERE day_date = $1::date
    `,
      [dayDate]
    );
    if (ex.rows[0]) {
      weekTotalPercent = Number(ex.rows[0].week_total_percent);
      jinPercent = Number(ex.rows[0].jin_percent);
      arsimetPercent = Number(ex.rows[0].arsimet_percent);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/hakedis_day_extras/i.test(msg) || !/does not exist/i.test(msg)) {
      console.error("[hakedis GET extras]", e);
    }
  }

  const weekTotalNum = Number(weekTotalTry);
  const jinHakedisTry = (weekTotalNum * jinPercent) / 100;
  const arsimetHakedisTry = (weekTotalNum * arsimetPercent) / 100;

  const people = personRows.map((row) => {
    const rate = Number(row.default_hakedis_percent ?? 0);
    const hakedisBase = Number(row.hakedis_base_amount ?? row.total_amount);
    const hk = (hakedisBase * rate) / 100;
    return {
      user_id: row.user_id,
      user_name: row.user_name,
      total_amount: row.total_amount,
      rate_percent: Number(rate.toFixed(2)),
      hakedis_try: hk.toFixed(2),
    };
  });

  return NextResponse.json({
    dayDate,
    dayOffset,
    weekStart: dayDate,
    weekEnd: dayDate,
    weekOffset: dayOffset,
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
