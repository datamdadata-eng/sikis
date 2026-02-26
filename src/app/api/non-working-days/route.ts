import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function isTableMissingError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /relation "non_working_days" does not exist/i.test(msg) || /does not exist/i.test(msg);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM (opsiyonel; yoksa son 60 gün)

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = `${y}-${String(m).padStart(2, "0")}-31`;
      const { rows } = await query<{ id: number; date: string; description: string | null }>(
        `
        SELECT id, date::text AS date, description
        FROM non_working_days
        WHERE date >= $1::date AND date <= $2::date
        ORDER BY date ASC
      `,
        [start, end]
      );
      return NextResponse.json(rows);
    }

    const { rows } = await query<{ id: number; date: string; description: string | null }>(
      `
      SELECT id, date::text AS date, description
      FROM non_working_days
      WHERE date >= (CURRENT_DATE - INTERVAL '60 days')
      ORDER BY date DESC
      LIMIT 50
    `
    );
    return NextResponse.json(rows);
  } catch (e) {
    if (isTableMissingError(e)) {
      return NextResponse.json([]);
    }
    console.error("[non-working-days GET]", e);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { date, description } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date_required" }, { status: 400 });
  }
  try {
    const { rows } = await query<{ id: number; date: string; description: string | null }>(
      `
      INSERT INTO non_working_days (date, description)
      VALUES ($1::date, $2::text)
      ON CONFLICT (date) DO UPDATE SET description = EXCLUDED.description
      RETURNING id, date::text AS date, description
    `,
      [date, description ?? null]
    );
    return NextResponse.json(rows[0]);
  } catch (e) {
    if (isTableMissingError(e)) {
      return NextResponse.json(
        { error: "setup_required", message: "non_working_days tablosu yok. Lütfen /api/setup çalıştırın." },
        { status: 503 }
      );
    }
    console.error("[non-working-days POST]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
