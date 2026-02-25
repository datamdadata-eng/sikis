import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month_required" }, { status: 400 });
  }
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { rows } = await query(
    `
    SELECT
      (sale_date::date)::text AS date,
      COALESCE(SUM(CASE WHEN status = 'onay' THEN amount ELSE 0 END), 0) AS total_onay,
      COALESCE(SUM(CASE WHEN status = 'patladi' THEN amount ELSE 0 END), 0) AS total_patladi,
      COALESCE(SUM(amount), 0) AS total_amount
    FROM sales
    WHERE sale_date::date >= $1 AND sale_date::date <= $2
    GROUP BY sale_date::date
    ORDER BY sale_date::date
  `,
    [startStr, endStr]
  );

  return NextResponse.json(rows);
}
