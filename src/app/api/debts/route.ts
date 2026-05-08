import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type DebtRow = {
  id: number;
  person_name: string;
  amount: string;
  description: string | null;
  currency: string;
  created_at: string;
};

type ReductionRow = {
  id: number;
  person_name: string;
  amount: string;
  currency: string;
  description: string | null;
  created_at: string;
};

async function loadReductions(): Promise<ReductionRow[]> {
  try {
    const { rows } = await query<ReductionRow>(
      `SELECT id, person_name, amount::text AS amount, currency, description, created_at
       FROM debt_reductions ORDER BY id DESC`
    );
    return rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "debt_reductions" does not exist/i.test(msg)) {
      return [];
    }
    console.error("[debts GET reductions]", e);
    return [];
  }
}

export async function GET() {
  const empty = { debts: [] as DebtRow[], reductions: [] as ReductionRow[] };

  try {
    const { rows } = await query<DebtRow>(
      `SELECT id, person_name, amount::text AS amount, description, currency, created_at FROM debts ORDER BY id DESC`
    );
    const reductions = await loadReductions();
    return NextResponse.json({ debts: rows, reductions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "debts" does not exist/i.test(msg)) {
      return NextResponse.json(empty);
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
        const debts = rows.map((r) => ({ ...r, currency: "TRY" as const }));
        const reductions = await loadReductions();
        return NextResponse.json({ debts, reductions });
      } catch (inner) {
        console.error("[debts GET legacy]", inner);
        return NextResponse.json(empty);
      }
    }
    console.error("[debts GET]", e);
    return NextResponse.json(empty, { status: 200 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const personName = String(body.personName ?? "").trim();
  const description = body.description != null ? String(body.description).trim() : null;
  const amount = Number(body.amount);
  const currencyRaw = String(body.currency ?? "USD").toUpperCase();
  const currency = currencyRaw === "TRY" ? "TRY" : "USD";

  if (!personName) {
    return NextResponse.json({ error: "person_required" }, { status: 400 });
  }
  if (Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const storedName = personName.toUpperCase();

  try {
    const { rows } = await query<{
      id: number;
      person_name: string;
      amount: string;
      description: string | null;
      currency: string;
    }>(
      `INSERT INTO debts (person_name, amount, description, currency) VALUES ($1, $2, $3, $4)
       RETURNING id, person_name, amount::text AS amount, description, currency`,
      [storedName, amount, description || null, currency]
    );
    return NextResponse.json(rows[0]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation "debts" does not exist/i.test(msg)) {
      return NextResponse.json(
        { error: "setup_required", message: "debts tablosu yok. POST /api/setup çalıştırın." },
        { status: 503 }
      );
    }
    if (/column "currency" does not exist/i.test(msg)) {
      return NextResponse.json(
        {
          error: "setup_required",
          message: "Borçlar güncellemesi için bir kez POST /api/setup çalıştırın (USD alanı).",
        },
        { status: 503 }
      );
    }
    console.error("[debts POST]", e);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
