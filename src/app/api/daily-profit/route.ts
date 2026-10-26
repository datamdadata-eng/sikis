import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query } from "@/lib/db";
import { fetchTryPerUsd } from "@/lib/frankfurter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isAuthorized(request: Request) {
  try {
    const auth = request.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return false;
    jwt.verify(auth.slice(7), JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS daily_profit_expenses (
      id SERIAL PRIMARY KEY,
      day_date DATE NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('percent', 'usd')),
      value NUMERIC(14,2) NOT NULL CHECK (value > 0),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS daily_profit_expenses_day_idx ON daily_profit_expenses(day_date)`);
  await query(`
    CREATE TABLE IF NOT EXISTS hakedis_day_extras (
      day_date DATE NOT NULL PRIMARY KEY,
      week_total_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
      jin_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
      arsimet_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
      captian_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
      mesai_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await query(`ALTER TABLE hakedis_day_extras ADD COLUMN IF NOT EXISTS mesai_percent NUMERIC(6,2) NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE hakedis_day_extras ADD COLUMN IF NOT EXISTS captian_percent NUMERIC(6,2) NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE money_recipients ADD COLUMN IF NOT EXISTS default_percentage NUMERIC(6,2) NOT NULL DEFAULT 0`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "invalid_date" }, { status: 400 });

  try {
    await ensureTables();
    const [revenueResult, peopleResult, extrasResult, recipientSharesResult, expensesResult, fx] = await Promise.all([
      query<{ total: string }>(`
        SELECT COALESCE(SUM(amount), 0)::text AS total
        FROM sales
        WHERE (sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1::date
      `, [date]),
      query<{ total: string }>(`
        WITH person_base AS (
          SELECT
            u.id,
            COALESCE(u.default_hakedis_percent, 0) AS base_rate,
            COALESCE(SUM(
              CASE
                WHEN s.user_id = u.id AND s.closer_user_id = u.id THEN 2 * s.amount
                WHEN s.user_id = u.id AND (s.closer_user_id IS NULL OR s.closer_user_id IS DISTINCT FROM s.user_id) THEN s.amount
                WHEN s.closer_user_id = u.id AND s.user_id IS DISTINCT FROM s.closer_user_id THEN s.amount
                ELSE 0
              END
            ), 0) AS hakedis_base
          FROM sales s
          INNER JOIN users u ON u.id = s.user_id OR u.id = s.closer_user_id
          WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1::date
          GROUP BY u.id, u.default_hakedis_percent
        ), day_extra AS (
          SELECT COALESCE(mesai_percent, 0) AS mesai_percent
          FROM hakedis_day_extras
          WHERE day_date = $1::date
        )
        SELECT COALESCE(SUM(
          p.hakedis_base * LEAST(100, p.base_rate + COALESCE((SELECT mesai_percent FROM day_extra), 0)) / 100
        ), 0)::text AS total
        FROM person_base p
      `, [date]),
      query<{ total: string }>(`
        SELECT COALESCE(
          (SELECT (COALESCE(jin_percent, 0) + COALESCE(arsimet_percent, 0) + COALESCE(captian_percent, 0)) / 100
           FROM hakedis_day_extras WHERE day_date = $1::date), 0
        )::text AS total
      `, [date]),
      query<{ total: string }>(`
        SELECT COALESCE(SUM(s.amount * COALESCE(r.default_percentage, 0) / 100), 0)::text AS total
        FROM sales s
        INNER JOIN money_recipients r ON r.id = s.recipient_id
        WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1::date
      `, [date]),
      query<{ id: number; label: string; kind: "percent" | "usd"; value: string }>(`
        SELECT id, label, kind, value::text
        FROM daily_profit_expenses
        WHERE day_date = $1::date
        ORDER BY id DESC
      `, [date]),
      fetchTryPerUsd(),
    ]);

    const revenueTry = Number(revenueResult.rows[0]?.total ?? 0);
    const peopleHakedisTry = Number(peopleResult.rows[0]?.total ?? 0);
    const specialRate = Number(extrasResult.rows[0]?.total ?? 0);
    const hakedisTry = peopleHakedisTry + revenueTry * specialRate;
    const recipientSharesTry = Number(recipientSharesResult.rows[0]?.total ?? 0);
    const tryPerUsd = Number(fx.tryPerUsd ?? 0);
    const expenses = expensesResult.rows.map((expense) => {
      const value = Number(expense.value);
      const amountTry = expense.kind === "percent" ? revenueTry * value / 100 : value * tryPerUsd;
      return { ...expense, value, amountTry };
    });
    const expensesTry = expenses.reduce((sum, expense) => sum + expense.amountTry, 0);
    const netTry = revenueTry - hakedisTry - recipientSharesTry - expensesTry;

    return NextResponse.json({
      date, revenueTry, hakedisTry, recipientSharesTry, expensesTry, netTry, expenses,
      tryPerUsd, fxDate: fx.fxDate, fxError: fx.error ?? null,
    });
  } catch (error) {
    console.error("[daily-profit GET]", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  const date = String(body.date ?? "");
  const label = String(body.label ?? "").trim();
  const value = Number(body.value);

  if (!DATE_RE.test(date) || !label || !Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "invalid_expense" }, { status: 400 });
  }

  try {
    await ensureTables();
    const result = await query<{ id: number }>(`
      INSERT INTO daily_profit_expenses (day_date, label, kind, value)
      VALUES ($1::date, $2, 'usd', $3)
      RETURNING id
    `, [date, label, value]);
    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("[daily-profit POST]", error);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
