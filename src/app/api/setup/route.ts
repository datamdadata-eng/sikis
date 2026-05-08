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
      CREATE TABLE IF NOT EXISTS debts (
        id SERIAL PRIMARY KEY,
        person_name TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS currency TEXT;`);
    await query(`UPDATE debts SET currency = 'TRY' WHERE currency IS NULL;`);
    await query(`ALTER TABLE debts ALTER COLUMN currency SET DEFAULT 'USD';`);
    await query(`ALTER TABLE debts ALTER COLUMN currency SET NOT NULL;`);
    await query(`ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_currency_check;`);
    await query(
      `ALTER TABLE debts ADD CONSTRAINT debts_currency_check CHECK (currency IN ('TRY', 'USD'));`
    );

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

    await query(`
      CREATE TABLE IF NOT EXISTS hakedis_week_user_rate (
        week_start DATE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('sales', 'closer')),
        rate_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (week_start, user_id, role)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS debt_reductions (
        id SERIAL PRIMARY KEY,
        person_name TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        currency TEXT NOT NULL CHECK (currency IN ('TRY', 'USD')),
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "setup_failed" }, { status: 500 });
  }
}

