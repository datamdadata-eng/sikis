import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query } from "@/lib/db";
import { fetchTryPerUsd } from "@/lib/frankfurter";

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

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS money_distributions (
      id SERIAL PRIMARY KEY,
      recipient_id INTEGER NOT NULL REFERENCES money_recipients(id) ON DELETE RESTRICT,
      amount_try NUMERIC(14,2) NOT NULL CHECK (amount_try >= 0),
      percentage NUMERIC(6,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
      distribution_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "invalid_date" }, { status: 400 });

  try {
    await ensureTable();
    const [rows, fx] = await Promise.all([
      query<{
        id: number;
        recipient_id: number;
        recipient_name: string;
        amount_try: string;
        percentage: string;
        distribution_date: string;
      }>(`
        SELECT d.id, d.recipient_id, r.name AS recipient_name, d.amount_try::text,
               d.percentage::text, d.distribution_date::text
        FROM money_distributions d
        INNER JOIN money_recipients r ON r.id = d.recipient_id
        WHERE d.distribution_date = $1::date
        ORDER BY d.id DESC
      `, [date]),
      fetchTryPerUsd(),
    ]);
    return NextResponse.json({ records: rows.rows, tryPerUsd: fx.tryPerUsd, fxDate: fx.fxDate, fxError: fx.error ?? null });
  } catch (error) {
    console.error("[money-distributions GET]", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const recipientId = Number(body.recipientId);
  const amountTry = Number(body.amountTry);
  const percentage = Number(body.percentage);
  const date = String(body.date ?? "");
  if (!Number.isInteger(recipientId) || recipientId <= 0 || !Number.isFinite(amountTry) || amountTry < 0 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100 || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    await ensureTable();
    const { rows } = await query<{ id: number }>(
      `INSERT INTO money_distributions (recipient_id, amount_try, percentage, distribution_date)
       VALUES ($1, $2, $3, $4::date) RETURNING id`,
      [recipientId, amountTry, percentage, date]
    );
    return NextResponse.json({ id: rows[0].id });
  } catch (error) {
    console.error("[money-distributions POST]", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
