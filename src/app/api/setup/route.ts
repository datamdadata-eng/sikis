import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS money_recipients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        closer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        amount NUMERIC(12,2) NOT NULL,
        description TEXT,
        status TEXT NOT NULL CHECK (status IN ('onay', 'patladi')),
        recipient_id INTEGER REFERENCES money_recipients(id) ON DELETE SET NULL,
        percentage NUMERIC(5,2),
        sale_date TIMESTAMPTZ DEFAULT now()
      );
    `);

    await query(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS closer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS non_working_days (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await query(
      `
      INSERT INTO admins (username, password)
      VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING;
    `,
      ["jin", "maslak1453"],
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "setup_failed" }, { status: 500 });
  }
}

