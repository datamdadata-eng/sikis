import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { fetchTryPerUsd } from "@/lib/frankfurter";

/** Her istekte güncel kur (önbellek yok). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
          AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
        GROUP BY u.id, u.name, u.default_hakedis_percent
      )
      SELECT c.user_id, c.user_name, c.amt_display::text AS total_amount,
             c.amt_hakedis::text AS hakedis_base_amount,
             COALESCE(c.default_hakedis_percent, 0)::text AS default_hakedis_percent
      FROM contrib c
      WHERE c.amt_display > 0
      ORDER BY c.amt_display DESC NULLS LAST
      `,
      [weekStart, weekEnd]
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
          WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
            AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
          GROUP BY u.id, u.name
        )
        SELECT c.user_id, c.user_name, c.amt_display::text AS total_amount,
               c.amt_hakedis::text AS hakedis_base_amount
        FROM contrib c
        WHERE c.amt_display > 0
        ORDER BY c.amt_display DESC NULLS LAST
        `,
        [weekStart, weekEnd]
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
