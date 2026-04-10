import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function seed() {
  console.log("🌱 Starting seed...\n");

  // ─── 0. Client ─────────────────────────────────────────────
  console.log("Checking client...");

  const existingClient = await sql`SELECT id FROM clients WHERE slug = 'thh'`;
  let clientId: number;

  if (existingClient.length > 0) {
    clientId = existingClient[0].id;
    console.log(`  Client THH already exists (id=${clientId}), skipping.`);
  } else {
    const [inserted] = await sql`
      INSERT INTO clients (name, slug, is_active, setup_complete)
      VALUES ('The Herbal Horse & Pet', 'thh', true, false)
      RETURNING id
    `;
    clientId = inserted.id;
    console.log(`  Created client: The Herbal Horse & Pet (id=${clientId})`);
  }
  console.log();

  // ─── 1. Manufacturers ──────────────────────────────────────
  console.log("Checking manufacturers...");

  const existingMfrs = await sql`SELECT name FROM manufacturers WHERE client_id = ${clientId} AND name IN ('Zinchar', 'Nutrimed')`;
  const existingMfrNames = existingMfrs.map((r) => r.name);

  if (!existingMfrNames.includes("Zinchar")) {
    await sql`INSERT INTO manufacturers (client_id, name, standard_lead_time_days, max_lead_time_days) VALUES (${clientId}, 'Zinchar', 40, 60)`;
    console.log("  Inserted manufacturer: Zinchar");
  } else {
    console.log("  Manufacturer Zinchar already exists, skipping.");
  }

  if (!existingMfrNames.includes("Nutrimed")) {
    await sql`INSERT INTO manufacturers (client_id, name, standard_lead_time_days, max_lead_time_days) VALUES (${clientId}, 'Nutrimed', 40, 60)`;
    console.log("  Inserted manufacturer: Nutrimed");
  } else {
    console.log("  Manufacturer Nutrimed already exists, skipping.");
  }

  const mfrRows = await sql`SELECT id, name FROM manufacturers WHERE client_id = ${clientId} AND name IN ('Zinchar', 'Nutrimed')`;
  const mfrIdByName: Record<string, number> = {};
  for (const row of mfrRows) {
    mfrIdByName[row.name] = row.id;
  }
  const zincharId = mfrIdByName["Zinchar"];
  const nutrimedId = mfrIdByName["Nutrimed"];

  console.log(`  Zinchar ID=${zincharId}, Nutrimed ID=${nutrimedId}\n`);

  // ─── 2. Products ───────────────────────────────────────────
  console.log("Inserting products...");

  type ProductDef = {
    sku_code: string;
    product_name: string;
    brand: string;
    category: string;
    pack_size_g: number | null;
    units_per_case: number | null;
    manufacturer_id: number | null;
    primary_stock_location: string;
  };

  const products: ProductDef[] = [
    { sku_code: "CM500",   product_name: "Calm Mix 500g",           brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "CM2000",  product_name: "Calm Mix 2kg",            brand: "THH", category: "HORSE_MIX", pack_size_g: 2000, units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "DM500",   product_name: "Digestion Mix 500g",      brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "DM2000",  product_name: "Digestion Mix 2kg",       brand: "THH", category: "HORSE_MIX", pack_size_g: 2000, units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "FM500",   product_name: "Farriers Mix 500g",       brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: nutrimedId, primary_stock_location: "THH" },
    { sku_code: "FM2000",  product_name: "Farriers Mix 2kg",        brand: "THH", category: "HORSE_MIX", pack_size_g: 2000, units_per_case: null, manufacturer_id: nutrimedId, primary_stock_location: "THH" },
    { sku_code: "IM500",   product_name: "Immune Mix 500g",         brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "IM2000",  product_name: "Immune Mix 2kg",          brand: "THH", category: "HORSE_MIX", pack_size_g: 2000, units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "ItM500",  product_name: "Itch Mix 500g",           brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "MM250",   product_name: "Mare Mix 250g",           brand: "THH", category: "HORSE_MIX", pack_size_g: 250,  units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "RM500",   product_name: "Rejuven Mix 500g",        brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "RM2000",  product_name: "Rejuven Mix 2kg",         brand: "THH", category: "HORSE_MIX", pack_size_g: 2000, units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "SHM500",  product_name: "Sport Horse Mix 500g",    brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "SM500",   product_name: "Stamina Mix 500g",        brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "SM2000",  product_name: "Stamina Mix 2kg",         brand: "THH", category: "HORSE_MIX", pack_size_g: 2000, units_per_case: null, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "UM500",   product_name: "Ultimate Mix 500g",       brand: "THH", category: "HORSE_MIX", pack_size_g: 500,  units_per_case: null, manufacturer_id: nutrimedId, primary_stock_location: "THH" },
    { sku_code: "UM2000",  product_name: "Ultimate Mix 2kg",        brand: "THH", category: "HORSE_MIX", pack_size_g: 2000, units_per_case: null, manufacturer_id: nutrimedId, primary_stock_location: "THH" },
    { sku_code: "AF200G",  product_name: "Allergy Itch Formula 200g",  brand: "THH", category: "PET_FORMULA", pack_size_g: 200, units_per_case: 6, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "AF500G",  product_name: "Allergy Itch Formula 500g",  brand: "THH", category: "PET_FORMULA", pack_size_g: 500, units_per_case: 6, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "EF200G",  product_name: "Everypet Formula 200g",      brand: "THH", category: "PET_FORMULA", pack_size_g: 200, units_per_case: 6, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "JF200G",  product_name: "Joint Formula 200g",         brand: "THH", category: "PET_FORMULA", pack_size_g: 200, units_per_case: 6, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "JF500G",  product_name: "Joint Formula 500g",         brand: "THH", category: "PET_FORMULA", pack_size_g: 500, units_per_case: 6, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "O3F75G",  product_name: "HP Omega 3 Formula 75g",     brand: "THH", category: "PET_FORMULA", pack_size_g: 75,  units_per_case: 6, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "PCF240G", product_name: "ParaCleanse Formula 240g",   brand: "THH", category: "PET_FORMULA", pack_size_g: 240, units_per_case: 6, manufacturer_id: nutrimedId, primary_stock_location: "THH" },
    { sku_code: "PCF500G", product_name: "ParaCleanse Formula 500g",   brand: "THH", category: "PET_FORMULA", pack_size_g: 500, units_per_case: 6, manufacturer_id: nutrimedId, primary_stock_location: "THH" },
    { sku_code: "SF40G",   product_name: "Serenity Formula 40g",       brand: "THH", category: "PET_FORMULA", pack_size_g: 40,  units_per_case: 6, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "SF200G",  product_name: "Serenity Formula 200g",      brand: "THH", category: "PET_FORMULA", pack_size_g: 200, units_per_case: 6, manufacturer_id: zincharId,  primary_stock_location: "THH" },
    { sku_code: "TSF",     product_name: "Tearstain Formula",          brand: "THH", category: "PET_FORMULA", pack_size_g: null, units_per_case: 6, manufacturer_id: null,       primary_stock_location: "THH" },
    { sku_code: "ACC30",   product_name: "Allergy Care Chews 30 pack",      brand: "THH", category: "CHEW", pack_size_g: null, units_per_case: 12, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "CCH30",   product_name: "Calming Chews 30 pack",           brand: "THH", category: "CHEW", pack_size_g: null, units_per_case: 12, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "CCH150",  product_name: "Calming Chews Bulk 150 pack",     brand: "THH", category: "CHEW", pack_size_g: null, units_per_case: 12, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "CC30",    product_name: "Conditioning Chews 30 pack",      brand: "THH", category: "CHEW", pack_size_g: null, units_per_case: 12, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "JCC30",   product_name: "Joint Care Chews 30 pack",        brand: "THH", category: "CHEW", pack_size_g: null, units_per_case: 12, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "TFC30",   product_name: "Tick and Flea Chews 30 pack",     brand: "THH", category: "CHEW", pack_size_g: null, units_per_case: 12, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "TFC150",  product_name: "Tick and Flea Chews Bulk 150 pack", brand: "THH", category: "CHEW", pack_size_g: null, units_per_case: 12, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "NTFS200", product_name: "Tick and Flea Spray 200ml",  brand: "THH", category: "SPRAY", pack_size_g: 200, units_per_case: 6, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "NS250",   product_name: "Natural Shampoo 250ml",      brand: "THH", category: "SHAMPOO", pack_size_g: 250, units_per_case: 6, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "CG90",    product_name: "Collagen Gravy 90g",         brand: "THH", category: "GRAVY", pack_size_g: 90,  units_per_case: 6, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "CG120",   product_name: "Collagen Gravy 120g",        brand: "THH", category: "GRAVY", pack_size_g: 120, units_per_case: 6, manufacturer_id: zincharId, primary_stock_location: "THH" },
    { sku_code: "NPACC30",  product_name: "NP Allergy Care Chews 30 pack",     brand: "NP", category: "CHEW",  pack_size_g: null, units_per_case: 12, manufacturer_id: nutrimedId, primary_stock_location: "88" },
    { sku_code: "NPCC30",   product_name: "NP Calming Chews 30 pack",          brand: "NP", category: "CHEW",  pack_size_g: null, units_per_case: 12, manufacturer_id: nutrimedId, primary_stock_location: "88" },
    { sku_code: "NPJCC30",  product_name: "NP Joint Care Chews 30 pack",       brand: "NP", category: "CHEW",  pack_size_g: null, units_per_case: 12, manufacturer_id: nutrimedId, primary_stock_location: "88" },
    { sku_code: "NPTFC30",  product_name: "NP Tick and Flea Chews 30 pack",    brand: "NP", category: "CHEW",  pack_size_g: null, units_per_case: 12, manufacturer_id: nutrimedId, primary_stock_location: "88" },
    { sku_code: "NPTFS200", product_name: "NP Tick and Flea Spray 200ml",      brand: "NP", category: "SPRAY", pack_size_g: 200,  units_per_case: 6,  manufacturer_id: nutrimedId, primary_stock_location: "88" },
  ];

  const existingProducts = await sql`SELECT sku_code FROM products WHERE client_id = ${clientId}`;
  const existingSkus = new Set(existingProducts.map((r) => r.sku_code));

  let insertedCount = 0;
  let skippedCount = 0;

  for (const p of products) {
    if (existingSkus.has(p.sku_code)) {
      skippedCount++;
      continue;
    }

    await sql`
      INSERT INTO products (client_id, sku_code, product_name, brand, category, pack_size_g, units_per_case, manufacturer_id, primary_stock_location, xero_item_code, is_active)
      VALUES (${clientId}, ${p.sku_code}, ${p.product_name}, ${p.brand}, ${p.category}, ${p.pack_size_g}, ${p.units_per_case}, ${p.manufacturer_id}, ${p.primary_stock_location}, ${p.sku_code}, true)
    `;
    console.log(`  Inserted product: ${p.sku_code} — ${p.product_name}`);
    insertedCount++;
  }

  console.log(`  Products: ${insertedCount} inserted, ${skippedCount} skipped.\n`);

  // ─── 3. AP Brand Mappings ──────────────────────────────────
  console.log("Inserting AP brand mappings...");

  const apMappings = [
    { ap_product_code: "ACCT30",      thh_sku_code: "ACC30",   ap_product_name: "AP Allergy Care Chews 30pk" },
    { ap_product_code: "CALMCT30",    thh_sku_code: "CCH30",   ap_product_name: "AP Calming Chews 30pk" },
    { ap_product_code: "AL200G",      thh_sku_code: "AF200G",  ap_product_name: "AP Allergy Formula 200g" },
    { ap_product_code: "NTFSR200ML",  thh_sku_code: "NTFS200", ap_product_name: "AP Tick & Flea Spray 200ml" },
    { ap_product_code: "EF200G",      thh_sku_code: "EF200G",  ap_product_name: "AP Everypet Formula 200g" },
    { ap_product_code: "JF200G",      thh_sku_code: "JF200G",  ap_product_name: "AP Joint Formula 200g" },
    { ap_product_code: "SF200G",      thh_sku_code: "SF200G",  ap_product_name: "AP Serenity Formula 200g" },
  ];

  const existingApMappings = await sql`SELECT ap_product_code FROM ap_brand_mappings WHERE client_id = ${clientId}`;
  const existingApCodes = new Set(existingApMappings.map((r) => r.ap_product_code));

  for (const m of apMappings) {
    if (existingApCodes.has(m.ap_product_code)) continue;

    await sql`
      INSERT INTO ap_brand_mappings (client_id, ap_product_code, thh_sku_code, ap_product_name)
      VALUES (${clientId}, ${m.ap_product_code}, ${m.thh_sku_code}, ${m.ap_product_name})
    `;
    console.log(`  Inserted AP mapping: ${m.ap_product_code} → ${m.thh_sku_code}`);
  }

  console.log();

  // ─── 4. PnP DC Codes (system_settings) ─────────────────────
  console.log("Inserting PnP DC codes into system_settings...");

  const pnpDcCodes = [
    { code: "MA15", name: "PnP Eastport Inland DC", region: "Gauteng" },
    { code: "MA05", name: "Philippi DC Groceries", region: "Western Cape" },
    { code: "KC37", name: "Cornubia", region: "KwaZulu-Natal" },
    { code: "KC19", name: "Hyper Midlands Mall", region: "KwaZulu-Natal" },
    { code: "EF05", name: "Family Queenstown", region: "Eastern Cape" },
  ];

  const existingSetting = await sql`SELECT id FROM system_settings WHERE client_id = ${clientId} AND key = 'pnp_dc_codes'`;

  if (existingSetting.length > 0) {
    await sql`UPDATE system_settings SET value = ${JSON.stringify(pnpDcCodes)}, updated_at = NOW() WHERE client_id = ${clientId} AND key = 'pnp_dc_codes'`;
    console.log("  Updated existing pnp_dc_codes setting.");
  } else {
    await sql`INSERT INTO system_settings (client_id, key, value) VALUES (${clientId}, 'pnp_dc_codes', ${JSON.stringify(pnpDcCodes)})`;
    console.log("  Inserted pnp_dc_codes setting.");
  }

  console.log("\nSeed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
