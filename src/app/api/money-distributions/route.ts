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

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "invalid_date" }, { status: 400 });

  try {
    await query(`ALTER TABLE money_recipients ADD COLUMN IF NOT EXISTS default_percentage NUMERIC(6,2) NOT NULL DEFAULT 0;`);
    const [rows, fx] = await Promise.all([
      query<{
        id: number;
        recipient_id: number;
        recipient_name: string;
        amount_try: string;
        percentage: string;
      }>(`
        SELECT r.id, r.id AS recipient_id, r.name AS recipient_name,
               COALESCE(SUM(s.amount), 0)::text AS amount_try,
               r.default_percentage::text AS percentage
        FROM money_recipients r
        LEFT JOIN sales s ON s.recipient_id = r.id
          AND (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1::date
        GROUP BY r.id, r.name, r.default_percentage
        ORDER BY r.name ASC
      `, [date]),
      fetchTryPerUsd(),
    ]);
    return NextResponse.json({ records: rows.rows, tryPerUsd: fx.tryPerUsd, fxDate: fx.fxDate, fxError: fx.error ?? null });
  } catch (error) {
    console.error("[money-distributions GET]", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}
