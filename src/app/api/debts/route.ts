import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { canonicalPersonKey } from "@/lib/person-name-key";
import { DEBT_CATEGORIES, DEFAULT_DEBT_CATEGORY, normalizeDebtCategory } from "@/lib/finance-categories";

type DebtRow = {
  id: number;
  person_name: string;
  amount: string;
  description: string | null;
  currency: string;
  category: string;
  created_at: string;
};

type ReductionRow = {
  id: number;
  person_name: string;
  amount: string;
  currency: string;
  category: string;
  description: string | null;
  created_at: string;
};

async function loadReductions(): Promise<ReductionRow[]> {
  try {
    const { rows } = await query<ReductionRow>(
      `SELECT id, person_name, amount::text AS amount, currency, category, description, created_at
       FROM debt_reductions ORDER BY id DESC`
    );
    return rows.map((r) => ({ ...r, category: normalizeDebtCategory(r.category) }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "debt_reductions" does not exist/i.test(msg)) {
      return [];
    }
    if (/column "category" does not exist/i.test(msg)) {
      try {
        const { rows } = await query<{
          id: number;
          person_name: string;
          amount: string;
          currency: string;
          description: string | null;
          created_at: string;
        }>(
          `SELECT id, person_name, amount::text AS amount, currency, description, created_at
           FROM debt_reductions ORDER BY id DESC`
        );
        return rows.map((r) => ({ ...r, category: DEFAULT_DEBT_CATEGORY }));
      } catch (inner) {
        console.error("[debts GET reductions legacy]", inner);
        return [];
      }
    }
    console.error("[debts GET reductions]", e);
    return [];
  }
}

export async function GET() {
  const empty = { debts: [] as DebtRow[], reductions: [] as ReductionRow[] };

  try {
    const { rows } = await query<DebtRow>(
      `SELECT id, person_name, amount::text AS amount, description, currency, category, created_at FROM debts ORDER BY id DESC`
    );
    const debts = rows.map((r) => ({ ...r, category: normalizeDebtCategory(r.category) }));
    const reductions = await loadReductions();
    const categoryRows = await query<{ name: string }>(
      `SELECT name FROM debt_categories ORDER BY id ASC`
    ).catch(() => ({ rows: DEBT_CATEGORIES.map((name) => ({ name })) }));
    const categories = Array.from(
      new Set([
        ...DEBT_CATEGORIES,
        ...categoryRows.rows.map((r) => normalizeDebtCategory(r.name)),
        ...debts.map((r) => r.category),
        ...reductions.map((r) => normalizeDebtCategory(r.category)),
      ].filter(Boolean))
    );
    return NextResponse.json({ debts, reductions, categories });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "debts" does not exist/i.test(msg)) {
      return NextResponse.json({ ...empty, categories: DEBT_CATEGORIES });
    }
    if (/column "currency" does not exist/i.test(msg)) {
      try {
        const { rows } = await query<{
          id: number;
          person_name: string;
          amount: string;
          description: string | null;
          created_at: string;
        }>(
          `SELECT id, person_name, amount::text AS amount, description, created_at FROM debts ORDER BY id DESC`
        );
        const debts = rows.map((r) => ({ ...r, currency: "TRY" as const, category: DEFAULT_DEBT_CATEGORY }));
        const reductions = await loadReductions();
        return NextResponse.json({ debts, reductions, categories: DEBT_CATEGORIES });
      } catch (inner) {
        console.error("[debts GET legacy]", inner);
        return NextResponse.json({ ...empty, categories: DEBT_CATEGORIES });
      }
    }
    if (/column "category" does not exist/i.test(msg)) {
      try {
        const { rows } = await query<{
          id: number;
          person_name: string;
          amount: string;
          description: string | null;
          currency: string;
          created_at: string;
        }>(
          `SELECT id, person_name, amount::text AS amount, description, currency, created_at FROM debts ORDER BY id DESC`
        );
        const debts = rows.map((r) => ({ ...r, category: DEFAULT_DEBT_CATEGORY }));
        const reductions = await loadReductions();
        return NextResponse.json({ debts, reductions, categories: DEBT_CATEGORIES });
      } catch (inner) {
        console.error("[debts GET legacy category]", inner);
        return NextResponse.json({ ...empty, categories: DEBT_CATEGORIES });
      }
    }
    console.error("[debts GET]", e);
    return NextResponse.json({ ...empty, categories: DEBT_CATEGORIES }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const personName = String(body.personName ?? "").trim();
  const description = body.description != null ? String(body.description).trim() : null;
  const amount = Number(body.amount);
  const currencyRaw = String(body.currency ?? "USD").toUpperCase();
  const currency = currencyRaw === "TRY" ? "TRY" : "USD";
  const category = normalizeDebtCategory(body.category);

  if (!personName) {
    return NextResponse.json({ error: "person_required" }, { status: 400 });
  }
  if (Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const storedName = canonicalPersonKey(personName);

  try {
    const { rows } = await query<{
      id: number;
      person_name: string;
      amount: string;
      description: string | null;
      currency: string;
      category: string;
    }>(
      `INSERT INTO debts (person_name, amount, description, currency, category) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, person_name, amount::text AS amount, description, currency, category`,
      [storedName, amount, description || null, currency, category]
    );
    await query(
      `INSERT INTO debt_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [category]
    ).catch(() => undefined);
    return NextResponse.json(rows[0]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "debts" does not exist/i.test(msg)) {
      return NextResponse.json(
        { error: "setup_required", message: "debts tablosu yok. POST /api/setup çalıştırın." },
        { status: 503 }
      );
    }
    if (/column "(currency|category)" does not exist/i.test(msg)) {
      return NextResponse.json(
        {
          error: "setup_required",
          message: "Borçlar güncellemesi için bir kez POST /api/setup çalıştırın.",
        },
        { status: 503 }
      );
    }
    console.error("[debts POST]", e);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
