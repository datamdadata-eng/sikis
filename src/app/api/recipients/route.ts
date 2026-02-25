import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const { rows } = await query<{ id: number; name: string }>(
    "SELECT id, name FROM money_recipients ORDER BY id DESC",
  );
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  const { rows } = await query<{ id: number; name: string }>(
    "INSERT INTO money_recipients (name) VALUES ($1) RETURNING id, name",
    [name],
  );
  return NextResponse.json(rows[0]);
}

