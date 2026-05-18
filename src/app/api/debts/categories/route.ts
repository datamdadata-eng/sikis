import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { DEBT_CATEGORIES, normalizeDebtCategory } from "@/lib/finance-categories";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = normalizeDebtCategory(body.name);

  if (!DEBT_CATEGORIES.includes(name as (typeof DEBT_CATEGORIES)[number])) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS debt_categories (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    const { rows } = await query<{ name: string }>(
      `INSERT INTO debt_categories (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING name`,
      [name]
    );
    return NextResponse.json(rows[0]);
  } catch (e) {
    console.error("[debt_categories POST]", e);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
