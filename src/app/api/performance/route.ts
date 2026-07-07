import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Period = "week" | "month";

type PerformanceRow = {
  user_id: number | null;
  user_name: string;
  rate_percent: string;
  user_count: string;
  user_onay_count: string;
  user_patladi_count: string;
  user_total: string;
  user_onay: string;
  user_patladi: string;
  closer_count: string;
  closer_onay_count: string;
  closer_patladi_count: string;
  closer_total: string;
  closer_onay: string;
  closer_patladi: string;
};

type TotalRow = {
  total_count: string;
  total_onay_count: string;
  total_patladi_count: string;
  total_amount: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") === "month" ? "month" : "week";
  const period = periodParam as Period;
  const offset = Math.min(120, Math.max(-120, parseInt(searchParams.get("offset") || "0", 10) || 0));

  const { rows: boundRows } = await query<{ start_date: string; end_date: string }>(
    `
    WITH ref AS (
      SELECT
        CASE
          WHEN $1 = 'month'
            THEN (((NOW() AT TIME ZONE 'Europe/Istanbul')::date + ($2 || ' months')::interval))::date
          ELSE (((NOW() AT TIME ZONE 'Europe/Istanbul')::date + ($2::int * 7)))::date
        END AS d
    ),
    bounds AS (
      SELECT
        CASE
          WHEN $1 = 'month' THEN date_trunc('month', d)::date
          ELSE (d - ((EXTRACT(ISODOW FROM d))::int - 1) * interval '1 day')::date
        END AS start_date,
        CASE
          WHEN $1 = 'month' THEN (date_trunc('month', d) + interval '1 month - 1 day')::date
          ELSE (d - ((EXTRACT(ISODOW FROM d))::int - 1) * interval '1 day' + interval '6 days')::date
        END AS end_date
      FROM ref
    )
    SELECT start_date::text, end_date::text FROM bounds
    `,
    [period, offset]
  );

  const startDate = boundRows[0]?.start_date;
  const endDate = boundRows[0]?.end_date;
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "period_bounds" }, { status: 500 });
  }

  const { rows } = await query<PerformanceRow>(
    `
    WITH filtered AS (
      SELECT *
      FROM sales s
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
        AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
    ),
    users_role AS (
      SELECT
        COALESCE('user:' || u.id::text, 'missing-user') AS person_key,
        u.id AS user_id,
        COALESCE(u.name, 'Tanımsız') AS user_name,
        COALESCE(u.default_hakedis_percent, 0) AS rate_percent,
        COUNT(s.id) AS user_count,
        COUNT(s.id) FILTER (WHERE s.status = 'onay') AS user_onay_count,
        COUNT(s.id) FILTER (WHERE s.status = 'patladi') AS user_patladi_count,
        COALESCE(SUM(s.amount), 0) AS user_total,
        COALESCE(SUM(s.amount) FILTER (WHERE s.status = 'onay'), 0) AS user_onay,
        COALESCE(SUM(s.amount) FILTER (WHERE s.status = 'patladi'), 0) AS user_patladi
      FROM filtered s
      LEFT JOIN users u ON s.user_id = u.id
      GROUP BY u.id, u.name, u.default_hakedis_percent
    ),
    closer_role AS (
      SELECT
        COALESCE('user:' || u.id::text, 'no-closer') AS person_key,
        u.id AS user_id,
        COALESCE(u.name, 'Kapatıcı yok') AS user_name,
        COALESCE(u.default_hakedis_percent, 0) AS rate_percent,
        COUNT(s.id) AS closer_count,
        COUNT(s.id) FILTER (WHERE s.status = 'onay') AS closer_onay_count,
        COUNT(s.id) FILTER (WHERE s.status = 'patladi') AS closer_patladi_count,
        COALESCE(SUM(s.amount), 0) AS closer_total,
        COALESCE(SUM(s.amount) FILTER (WHERE s.status = 'onay'), 0) AS closer_onay,
        COALESCE(SUM(s.amount) FILTER (WHERE s.status = 'patladi'), 0) AS closer_patladi
      FROM filtered s
      LEFT JOIN users u ON s.closer_user_id = u.id
      GROUP BY u.id, u.name, u.default_hakedis_percent
    ),
    people AS (
      SELECT person_key, user_id, user_name FROM users_role
      UNION
      SELECT person_key, user_id, user_name FROM closer_role
    )
    SELECT
      p.user_id,
      p.user_name,
      COALESCE(ur.rate_percent, cr.rate_percent, 0)::text AS rate_percent,
      COALESCE(ur.user_count, 0)::text AS user_count,
      COALESCE(ur.user_onay_count, 0)::text AS user_onay_count,
      COALESCE(ur.user_patladi_count, 0)::text AS user_patladi_count,
      COALESCE(ur.user_total, 0)::text AS user_total,
      COALESCE(ur.user_onay, 0)::text AS user_onay,
      COALESCE(ur.user_patladi, 0)::text AS user_patladi,
      COALESCE(cr.closer_count, 0)::text AS closer_count,
      COALESCE(cr.closer_onay_count, 0)::text AS closer_onay_count,
      COALESCE(cr.closer_patladi_count, 0)::text AS closer_patladi_count,
      COALESCE(cr.closer_total, 0)::text AS closer_total,
      COALESCE(cr.closer_onay, 0)::text AS closer_onay,
      COALESCE(cr.closer_patladi, 0)::text AS closer_patladi
    FROM people p
    LEFT JOIN users_role ur ON p.person_key = ur.person_key
    LEFT JOIN closer_role cr ON p.person_key = cr.person_key
    ORDER BY (COALESCE(ur.user_total, 0) + COALESCE(cr.closer_total, 0)) DESC, p.user_name ASC
    `,
    [startDate, endDate]
  );

  const { rows: totalRows } = await query<TotalRow>(
    `
    SELECT
      COUNT(*)::text AS total_count,
      COUNT(*) FILTER (WHERE status = 'onay')::text AS total_onay_count,
      COUNT(*) FILTER (WHERE status = 'patladi')::text AS total_patladi_count,
      COALESCE(SUM(amount), 0)::text AS total_amount
    FROM sales s
    WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date >= $1::date
      AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date <= $2::date
    `,
    [startDate, endDate]
  );

  return NextResponse.json({
    period,
    offset,
    startDate,
    endDate,
    rows,
    totals: totalRows[0] ?? {
      total_count: "0",
      total_onay_count: "0",
      total_patladi_count: "0",
      total_amount: "0",
    },
  });
}
