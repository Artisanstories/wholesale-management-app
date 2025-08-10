// server/db.js
import pkg from "pg";
const { Pool } = pkg;

/**
 * Connect to Render Postgres.
 * If your DATABASE_URL includes `sslmode=require`, enable SSL.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

export async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wholesale_settings (
      shop TEXT PRIMARY KEY,
      discount_percent NUMERIC NOT NULL,
      vat_rate_percent NUMERIC NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function getSettingsForShop(shop) {
  const { rows } = await pool.query(
    `SELECT discount_percent, vat_rate_percent
     FROM wholesale_settings WHERE shop = $1`,
    [shop]
  );
  if (!rows.length) return null;
  return {
    discountPercent: Number(rows[0].discount_percent),
    vatPercent: Number(rows[0].vat_rate_percent),
  };
}

export async function saveSettingsForShop(shop, discountPercent, vatPercent) {
  await pool.query(
    `INSERT INTO wholesale_settings (shop, discount_percent, vat_rate_percent, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (shop) DO UPDATE
       SET discount_percent = EXCLUDED.discount_percent,
           vat_rate_percent = EXCLUDED.vat_rate_percent,
           updated_at = NOW()`,
    [shop, discountPercent, vatPercent]
  );
}
