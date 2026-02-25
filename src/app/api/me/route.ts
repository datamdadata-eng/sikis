import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const token = auth.slice("Bearer ".length);

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; iat: number; exp: number };

    return NextResponse.json({
      id: decoded.id,
      username: decoded.username,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

