import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const { rows } = await query(
    `
    SELECT
      s.id,
      s.amount,
      s.description,
      s.status,
      s.sale_date,
      s.recipient_id,
      to_char(s.sale_date AT TIME ZONE 'Europe/Istanbul', 'DD.MM.YY HH24:MI') AS sale_date_display,
      u.name AS user_name,
      cu.name AS closer_name,
      r.name AS recipient_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN users cu ON s.closer_user_id = cu.id
    LEFT JOIN money_recipients r ON s.recipient_id = r.id
    ORDER BY s.sale_date DESC
  `,
  );
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, closerId, amount, description, status, recipientId } = body;

  if (!userId || !amount || !status || !recipientId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const parsedAmount = Number(amount);

  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  if (status !== "onay" && status !== "patladi") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { rows } = await query(
    `
    INSERT INTO sales (user_id, closer_user_id, amount, description, status, recipient_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `,
    [userId, closerId ?? null, parsedAmount, description ?? null, status, recipientId],
  );

  return NextResponse.json({ id: rows[0].id });
}

