import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

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

function recordId(context: { params: Promise<{ id: string }> }) {
  return context.params.then(({ id }) => Number(id));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = await recordId(context);
  const body = await request.json().catch(() => ({}));
  const amountTry = Number(body.amountTry);
  const percentage = Number(body.percentage);
  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(amountTry) || amountTry < 0 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { rows } = await query<{ id: number }>(
    `UPDATE money_distributions SET amount_try = $1, percentage = $2, updated_at = now() WHERE id = $3 RETURNING id`,
    [amountTry, percentage, id]
  );
  if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = await recordId(context);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const { rows } = await query<{ id: number }>(`DELETE FROM money_distributions WHERE id = $1 RETURNING id`, [id]);
  if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
