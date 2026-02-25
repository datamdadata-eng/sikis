import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username ?? "").trim();
    const password = (body.password ?? "").trim();

    if (!username || !password) {
      return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
    }

    const { rows } = await query<{ id: number; username: string; password: string }>(
      "SELECT id, username, password FROM admins WHERE username = $1 LIMIT 1",
      [username],
    );

    const admin = rows[0];

    if (!admin || admin.password !== password) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return NextResponse.json({
      token,
      user: { id: admin.id, username: admin.username },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "login_failed" }, { status: 500 });
  }
}

