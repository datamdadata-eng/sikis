import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date_required" }, { status: 400 });
  }

  const [totalsRes, usersRes, closersRes] = await Promise.all([
    query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'onay' THEN amount ELSE 0 END), 0) AS total_onay,
        COALESCE(SUM(CASE WHEN status = 'patladi' THEN amount ELSE 0 END), 0) AS total_patladi,
        COALESCE(SUM(amount), 0) AS total_amount
      FROM sales
      WHERE (sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1
    `,
      [date]
    ),
    query(
      `
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        SUM(CASE WHEN s.status = 'onay' THEN s.amount ELSE 0 END) AS total_onay,
        SUM(CASE WHEN s.status = 'patladi' THEN s.amount ELSE 0 END) AS total_patladi,
        SUM(s.amount) AS total_amount
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1
      GROUP BY u.id, u.name
      ORDER BY total_amount DESC NULLS LAST
    `,
      [date]
    ),
    query(
      `
      SELECT
        u.id AS closer_id,
        u.name AS closer_name,
        SUM(CASE WHEN s.status = 'onay' THEN s.amount ELSE 0 END) AS total_onay,
        SUM(CASE WHEN s.status = 'patladi' THEN s.amount ELSE 0 END) AS total_patladi,
        SUM(s.amount) AS total_amount
      FROM sales s
      LEFT JOIN users u ON s.closer_user_id = u.id
      WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = $1
      GROUP BY u.id, u.name
      ORDER BY total_amount DESC NULLS LAST
    `,
      [date]
    ),
  ]);

  const totals = totalsRes.rows[0] ?? {
    total_onay: "0",
    total_patladi: "0",
    total_amount: "0",
  };

  return NextResponse.json({
    date,
    total_onay: totals.total_onay,
    total_patladi: totals.total_patladi,
    total_amount: totals.total_amount,
    net: Number(totals.total_onay) - Number(totals.total_patladi),
    users: usersRes.rows,
    closers: closersRes.rows,
  });
}
