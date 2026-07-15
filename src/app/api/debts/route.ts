import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { canonicalPersonKey } from "@/lib/person-name-key";
import { DEFAULT_DEBT_CATEGORY } from "@/lib/finance-categories";

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

export async function ensureDebtTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS debts (
      id SERIAL PRIMARY KEY,
      person_name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS currency TEXT;`);
  await query(`UPDATE debts SET currency = 'USD' WHERE currency IS NULL OR TRIM(currency) = '';`);
  await query(`ALTER TABLE debts ALTER COLUMN currency SET DEFAULT 'USD';`);
  await query(`ALTER TABLE debts ALTER COLUMN currency SET NOT NULL;`);
  await query(`ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_currency_check;`);
  await query(`ALTER TABLE debts ADD CONSTRAINT debts_currency_check CHECK (currency IN ('TRY', 'USD'));`);
  await query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS category TEXT;`);
  await query(`UPDATE debts SET category = $1 WHERE category IS NULL OR TRIM(category) = '';`, [DEFAULT_DEBT_CATEGORY]);
  await query(`ALTER TABLE debts ALTER COLUMN category SET DEFAULT '${DEFAULT_DEBT_CATEGORY}';`);
  await query(`ALTER TABLE debts ALTER COLUMN category SET NOT NULL;`);

  await query(`
    CREATE TABLE IF NOT EXISTS debt_reductions (
      id SERIAL PRIMARY KEY,
      person_name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL CHECK (currency IN ('TRY', 'USD')),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await query(`ALTER TABLE debt_reductions ADD COLUMN IF NOT EXISTS category TEXT;`);
  await query(`UPDATE debt_reductions SET category = $1 WHERE category IS NULL OR TRIM(category) = '';`, [
    DEFAULT_DEBT_CATEGORY,
  ]);
  await query(`ALTER TABLE debt_reductions ALTER COLUMN category SET DEFAULT '${DEFAULT_DEBT_CATEGORY}';`);
  await query(`ALTER TABLE debt_reductions ALTER COLUMN category SET NOT NULL;`);

  await query(`
    INSERT INTO debts (person_name, amount, description, currency, created_at, category)
    SELECT v.person_name, v.amount, v.description, v.currency, v.created_at, $1
    FROM debts_v2 v
    WHERE NOT EXISTS (
      SELECT 1
      FROM debts d
      WHERE d.person_name = v.person_name
        AND d.amount = v.amount
        AND COALESCE(d.description, '') = COALESCE(v.description, '')
        AND d.created_at = v.created_at
    )
  `, [DEFAULT_DEBT_CATEGORY]).catch(() => undefined);

  await query(`
    INSERT INTO debt_reductions (person_name, amount, currency, description, created_at, category)
    SELECT v.person_name, v.amount, v.currency, v.description, v.created_at, $1
    FROM debt_reductions_v2 v
    WHERE NOT EXISTS (
      SELECT 1
      FROM debt_reductions r
      WHERE r.person_name = v.person_name
        AND r.amount = v.amount
        AND r.currency = v.currency
        AND COALESCE(r.description, '') = COALESCE(v.description, '')
        AND r.created_at = v.created_at
    )
  `, [DEFAULT_DEBT_CATEGORY]).catch(() => undefined);
}

async function loadDebts(): Promise<DebtRow[]> {
  const { rows } = await query<DebtRow>(
    `SELECT id, person_name, amount::text AS amount, description, currency, created_at
     FROM debts ORDER BY id DESC`
  );
  return rows;
}

async function loadReductions(): Promise<ReductionRow[]> {
  const { rows } = await query<ReductionRow>(
    `SELECT id, person_name, amount::text AS amount, currency, description, created_at
     FROM debt_reductions ORDER BY id DESC`
  );
  return rows;
}

export async function GET() {
  const empty = { debts: [] as DebtRow[], reductions: [] as ReductionRow[] };

  try {
    await ensureDebtTables();
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
    await ensureDebtTables();
    const { rows } = await query<DebtRow>(
      `INSERT INTO debts (person_name, amount, description, currency, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, person_name, amount::text AS amount, description, currency, created_at`,
      [storedName, amount, description || null, currency, DEFAULT_DEBT_CATEGORY]
    );
    return NextResponse.json(rows[0]);
  } catch (e) {
    console.error("[debts POST]", e);
    return NextResponse.json({ error: "insert_failed", message: "Borç eklenemedi." }, { status: 500 });
  }
}
