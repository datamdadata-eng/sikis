import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const { rows: todayRows } = await query<{ today: string }>(
    `SELECT ((NOW() AT TIME ZONE 'Europe/Istanbul')::date)::text AS today`
  );
  const todayStr = todayRows?.[0]?.today;

  const { rows } = await query<{
    day: string;
    total_onay: string;
    total_patladi: string;
  }>(
    `
    SELECT
      ((sale_date AT TIME ZONE 'Europe/Istanbul')::date)::text AS day,
      SUM(CASE WHEN status = 'onay' THEN amount ELSE 0 END)::text AS total_onay,
      SUM(CASE WHEN status = 'patladi' THEN amount ELSE 0 END)::text AS total_patladi
    FROM sales
    GROUP BY (sale_date AT TIME ZONE 'Europe/Istanbul')::date
    ORDER BY (sale_date AT TIME ZONE 'Europe/Istanbul')::date DESC
    LIMIT 30
  `,
  );

  // Bugün (Istanbul) her zaman ilk sırada olsun; yoksa 0'lı satır ekle
  if (todayStr && (rows.length === 0 || rows[0].day !== todayStr)) {
    rows.unshift({
      day: todayStr,
      total_onay: "0",
      total_patladi: "0",
    });
  }

  return NextResponse.json(rows);
}

