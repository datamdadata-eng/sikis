import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { canonicalPersonKey } from "@/lib/person-name-key";
import { ensureDebtV2Tables } from "../route";

async function balanceFor(personKey: string, currency: "USD" | "TRY"): Promise<number> {
  const { rows } = await query<{ balance: string }>(
    `
    WITH d AS (
      SELECT COALESCE(SUM(amount), 0) AS s FROM debts_v2
      WHERE REPLACE(UPPER(TRIM(person_name)), 'İ', 'I') = $1 AND currency = $2
    ),
    r AS (
      SELECT COALESCE(SUM(amount), 0) AS s FROM debt_reductions_v2
      WHERE REPLACE(UPPER(TRIM(person_name)), 'İ', 'I') = $1 AND currency = $2
    )
    SELECT (d.s - r.s)::text AS balance FROM d, r
    `,
    [personKey, currency]
  );
  return Number(rows[0]?.balance ?? 0);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const personName = String(body.personName ?? "").trim();
  const amount = Number(body.amount);
  const currencyRaw = String(body.currency ?? "USD").toUpperCase();
  const currency: "USD" | "TRY" = currencyRaw === "TRY" ? "TRY" : "USD";
  const description = body.description != null ? String(body.description).trim() || null : null;

  if (!personName) {
    return NextResponse.json({ error: "person_required" }, { status: 400 });
  }
  const personKey = canonicalPersonKey(personName);
  if (!personKey) {
    return NextResponse.json({ error: "person_required" }, { status: 400 });
  }
  if (Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  try {
    await ensureDebtV2Tables();
    const bal = await balanceFor(personKey, currency);
    if (bal <= 0) {
      return NextResponse.json(
        { error: "no_balance", message: "Bu kisi ve para birimi icin dusulecek borc kalmadi." },
        { status: 400 }
      );
    }
    const cents = (x: number) => Math.round(x * 100);
    if (cents(amount) > cents(bal)) {
      return NextResponse.json(
        { error: "exceeds_balance", balance: bal, message: `Kalan borc: ${bal}` },
        { status: 400 }
      );
    }

    const { rows } = await query<{
      id: number;
      person_name: string;
      amount: string;
      currency: string;
      description: string | null;
      created_at: string;
    }>(
      `INSERT INTO debt_reductions_v2 (person_name, amount, currency, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, person_name, amount::text AS amount, currency, description, created_at`,
      [personKey, amount, currency, description]
    );
    return NextResponse.json(rows[0]);
  } catch (e) {
    console.error("[debts/reduce POST]", e);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
