import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { EXPENSE_CATEGORIES, normalizeExpenseCategory } from "@/lib/finance-categories";

type ExpenseRow = {
  id: number;
  category: string;
  amount: string;
  note: string | null;
  created_at: string;
};

export async function GET() {
  const empty = { expenses: [] as ExpenseRow[], categories: EXPENSE_CATEGORIES };

  try {
    const { rows } = await query<ExpenseRow>(
      `SELECT id, category, amount::text AS amount, note, created_at FROM expenses ORDER BY id DESC`
    );
    const categoryRows = await query<{ name: string }>(
      `SELECT name FROM expense_categories ORDER BY id ASC`
    ).catch(() => ({ rows: EXPENSE_CATEGORIES.map((name) => ({ name })) }));
    const categories = Array.from(
      new Set([
        ...EXPENSE_CATEGORIES,
        ...categoryRows.rows.map((r) => normalizeExpenseCategory(r.name)),
        ...rows.map((r) => normalizeExpenseCategory(r.category)),
      ])
    );
    return NextResponse.json({ expenses: rows, categories });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "expenses" does not exist/i.test(msg)) {
      return NextResponse.json(empty);
    }
    console.error("[expenses GET]", e);
    return NextResponse.json(empty, { status: 200 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const category = normalizeExpenseCategory(body.category);
  const note = body.note != null ? String(body.note).trim() : null;

  if (Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  try {
    const { rows } = await query<ExpenseRow>(
      `INSERT INTO expenses (category, amount, note)
       VALUES ($1, $2, $3)
       RETURNING id, category, amount::text AS amount, note, created_at`,
      [category, amount, note || null]
    );
    await query(
      `INSERT INTO expense_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [category]
    ).catch(() => undefined);
    return NextResponse.json(rows[0]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "expenses" does not exist/i.test(msg)) {
      return NextResponse.json(
        { error: "setup_required", message: "Giderler için bir kez POST /api/setup çalıştırın." },
        { status: 503 }
      );
    }
    console.error("[expenses POST]", e);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
