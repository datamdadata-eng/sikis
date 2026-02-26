import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const { rows } = await query(
    `
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      SUM(CASE WHEN s.status = 'onay' THEN s.amount ELSE 0 END) AS total_onay,
      SUM(CASE WHEN s.status = 'patladi' THEN s.amount ELSE 0 END) AS total_patladi,
      SUM(s.amount) AS total_amount
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE (s.sale_date AT TIME ZONE 'Europe/Istanbul')::date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date
    GROUP BY u.id, u.name
    ORDER BY total_amount DESC NULLS LAST
  `,
  );

  return NextResponse.json(rows);
}


