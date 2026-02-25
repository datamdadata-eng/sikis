import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const { rows } = await query(
    `
    SELECT
      date_trunc('day', sale_date) AS day,
      SUM(CASE WHEN status = 'onay' THEN amount ELSE 0 END) AS total_onay,
      SUM(CASE WHEN status = 'patladi' THEN amount ELSE 0 END) AS total_patladi
    FROM sales
    GROUP BY day
    ORDER BY day DESC
    LIMIT 30
  `,
  );
  return NextResponse.json(rows);
}

