import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { canonicalPersonKey } from "@/lib/person-name-key";

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

export async function ensureDebtV2Tables() {
  await query(`
    CREATE TABLE IF NOT EXISTS debts_v2 (
      id SERIAL PRIMARY KEY,
      person_name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      description TEXT,
      currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('TRY', 'USD')),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS debt_reductions_v2 (
      id SERIAL PRIMARY KEY,
      person_name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL CHECK (currency IN ('TRY', 'USD')),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function loadDebts(): Promise<DebtRow[]> {
  const { rows } = await query<DebtRow>(
    `SELECT id, person_name, amount::text AS amount, description, currency, created_at
     FROM debts_v2 ORDER BY id DESC`
  );
  return rows;
}

async function loadReductions(): Promise<ReductionRow[]> {
  const { rows } = await query<ReductionRow>(
    `SELECT id, person_name, amount::text AS amount, currency, description, created_at
     FROM debt_reductions_v2 ORDER BY id DESC`
  );
  return rows;
}

export async function GET() {
  const empty = { debts: [] as DebtRow[], reductions: [] as ReductionRow[] };

  try {
    await ensureDebtV2Tables();
    const debts = await loadDebts();
    const reductions = await loadReductions();
    return NextResponse.json({ debts, reductions });
  } catch (e) {
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
    return NextResponse.json({ error: "person_required", message: "Kişi adı girin." }, { status: 400 });
  }
  if (Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount", message: "Geçerli bir tutar girin." }, { status: 400 });
  }

  const storedName = canonicalPersonKey(personName);
  if (!storedName) {
    return NextResponse.json({ error: "person_required", message: "Kişi adı girin." }, { status: 400 });
  }

  try {
    await ensureDebtV2Tables();
    const { rows } = await query<DebtRow>(
      `INSERT INTO debts_v2 (person_name, amount, description, currency)
       VALUES ($1, $2, $3, $4)
       RETURNING id, person_name, amount::text AS amount, description, currency, created_at`,
      [storedName, amount, description || null, currency]
    );
    return NextResponse.json(rows[0]);
  } catch (e) {
    console.error("[debts POST]", e);
    return NextResponse.json({ error: "insert_failed", message: "Borç eklenemedi." }, { status: 500 });
  }
}
