import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const { rows } = await query(
    `
    SELECT
      ((sale_date AT TIME ZONE 'Europe/Istanbul')::date)::text AS day,
      SUM(CASE WHEN status = 'onay' THEN amount ELSE 0 END) AS total_onay,
      SUM(CASE WHEN status = 'patladi' THEN amount ELSE 0 END) AS total_patladi
    FROM sales
    GROUP BY (sale_date AT TIME ZONE 'Europe/Istanbul')::date
    ORDER BY (sale_date AT TIME ZONE 'Europe/Istanbul')::date DESC
    LIMIT 30
  `,
  );
  return NextResponse.json(rows);
}

