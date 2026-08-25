import { NextResponse } from "next/server";
import { query } from "@/lib/db";

async function ensureDefaultPercentageColumn() {
  await query(`ALTER TABLE money_recipients ADD COLUMN IF NOT EXISTS default_percentage NUMERIC(6,2) NOT NULL DEFAULT 0;`);
}

export async function GET() {
  await ensureDefaultPercentageColumn();
  const { rows } = await query<{ id: number; name: string; default_percentage: string }>(
    "SELECT id, name, default_percentage::text FROM money_recipients ORDER BY id DESC",
  );
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  const percentage = Number(body.defaultPercentage ?? 0);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return NextResponse.json({ error: "invalid_percentage" }, { status: 400 });
  }
  await ensureDefaultPercentageColumn();
  const { rows } = await query<{ id: number; name: string; default_percentage: string }>(
    "INSERT INTO money_recipients (name, default_percentage) VALUES ($1, $2) RETURNING id, name, default_percentage::text",
    [name, percentage],
  );
  return NextResponse.json(rows[0]);
}

