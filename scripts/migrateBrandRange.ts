/**
 * One-shot migration: derive `products.range` from existing brand+category,
 * and clean up `brand` to mean ownership only (THH or NP).
 *
 * Logic:
 *   range = NP   if brand == "NP"
 *   range = HH   if category contains "HORSE"
 *   range = HP   otherwise
 *
 *   brand: any brand="HH" → "THH" (HH was being used as range, not ownership)
 *   brand: NP stays NP
 *   brand: THH stays THH
 *
 * Usage:
 *   doppler run                  -- npx tsx scripts/migrateBrandRange.ts
 *   doppler run --config prd     -- npx tsx scripts/migrateBrandRange.ts
 *   doppler run                  -- npx tsx scripts/migrateBrandRange.ts --apply
 *
 * Without --apply, prints the proposed diff and exits without writing.
 */

import "dotenv/config";
import pg from "pg";

const apply = process.argv.includes("--apply");

interface ProductRow {
  id: number;
  sku_code: string;
  product_name: string;
  brand: string;
  category: string;
  range: string | null;
}

function deriveRange(brand: string, category: string, productName: string): string {
  if (brand === "NP") return "NP";
  // HH signal: category contains HORSE, OR product name has " mix" (Stamina Mix,
  // Itch mix, Mare mix, etc. — covers cases where category was set wrong like
  // ITM2000 which has category="HH" by mistake).
  const cat = category.toUpperCase();
  const name = productName.toLowerCase();
  if (cat.includes("HORSE") || / mix\b/i.test(productName) || /^mix /i.test(name)) return "HH";
  return "HP";
}

function deriveBrand(brand: string): string {
  if (brand === "HH") return "THH"; // HH was being used as range; ownership is THH
  return brand;
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<ProductRow>(
      "SELECT id, sku_code, product_name, brand, category, range FROM products ORDER BY brand, sku_code",
    );

    const changes: { id: number; sku: string; name: string; from: string; to: string }[] = [];
    for (const r of rows) {
      const newRange = deriveRange(r.brand, r.category, r.product_name);
      const newBrand = deriveBrand(r.brand);
      const before = `brand=${r.brand} range=${r.range ?? "null"}`;
      const after = `brand=${newBrand} range=${newRange}`;
      if (before !== after) {
        changes.push({ id: r.id, sku: r.sku_code, name: r.product_name, from: before, to: after });
      }
    }

    console.log(`Total products: ${rows.length}`);
    console.log(`Changes proposed: ${changes.length}`);
    console.log("");
    for (const c of changes) {
      console.log(`  ${c.sku.padEnd(10)} | ${c.name.padEnd(40)} | ${c.from} → ${c.to}`);
    }
    console.log("");

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to commit.");
      return;
    }

    console.log("Applying...");
    let updated = 0;
    for (const c of changes) {
      const newBrand = c.to.match(/brand=([^\s]+)/)![1];
      const newRange = c.to.match(/range=([^\s]+)/)![1];
      await pool.query(
        "UPDATE products SET brand = $1, range = $2 WHERE id = $3",
        [newBrand, newRange, c.id],
      );
      updated++;
    }
    console.log(`Applied ${updated} updates.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
