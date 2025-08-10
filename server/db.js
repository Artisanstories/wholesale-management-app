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
  // App settings per shop
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wholesale_settings (
      shop TEXT PRIMARY KEY,
      discount_percent NUMERIC NOT NULL,
      vat_rate_percent NUMERIC NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Tag → discount rules per shop
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wholesale_tag_rules (
      shop TEXT NOT NULL,
      tag TEXT NOT NULL,
      discount_percent NUMERIC NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (shop, tag)
    );
  `);
}

/* ---------- Settings (global per shop) ---------- */

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

/* ---------- Tag Rules ---------- */

export async function getRules(shop) {
  const { rows } = await pool.query(
    `SELECT tag, discount_percent
     FROM wholesale_tag_rules WHERE shop = $1
     ORDER BY tag ASC`,
    [shop]
  );
  return rows.map(r => ({
    tag: r.tag,
    discountPercent: Number(r.discount_percent),
  }));
}

export async function upsertRule(shop, tag, discountPercent) {
  const t = String(tag || "").trim().toLowerCase();
  await pool.query(
    `INSERT INTO wholesale_tag_rules (shop, tag, discount_percent, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (shop, tag) DO UPDATE
       SET discount_percent = EXCLUDED.discount_percent,
           updated_at = NOW()`,
    [shop, t, discountPercent]
  );
}

export async function deleteRule(shop, tag) {
  const t = String(tag || "").trim().toLowerCase();
  await pool.query(
    `DELETE FROM wholesale_tag_rules WHERE shop = $1 AND tag = $2`,
    [shop, t]
  );
}

/**
 * Given a list of customer tags, return the BEST (max) discount for this shop.
 * Falls back to `defaultDiscount` if no tag matches a rule.
 */
export async function getDiscountForTags(shop, tags, defaultDiscount) {
  const norm = (tags || []).map(t => String(t || "").trim().toLowerCase()).filter(Boolean);
  if (!norm.length) return defaultDiscount;

  const { rows } = await pool.query(
    `SELECT MAX(discount_percent) AS best
     FROM wholesale_tag_rules
     WHERE shop = $1 AND tag = ANY($2::text[])`,
    [shop, norm]
  );

  const best = rows?.[0]?.best;
  return (best === null || best === undefined) ? defaultDiscount : Number(best);
}
