/**
 * Standalone Seed Script
 * Run: node src/db/seed.js
 * Seeds the database with realistic demo data.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config');

async function runSeed() {
  console.log('[Seed] Starting data seeding...');

  const pool = new Pool({ connectionString: config.databaseUrl });

  try {
    const seedPath = path.join(__dirname, '../../seed/seed_data.sql');
    if (!fs.existsSync(seedPath)) {
      console.error('[Seed] seed_data.sql not found at', seedPath);
      process.exit(1);
    }

    const seedSql = fs.readFileSync(seedPath, 'utf8');
    console.log('[Seed] Executing seed_data.sql...');
    await pool.query(seedSql);
    console.log('[Seed] Data seeded successfully.');
  } catch (err) {
    console.error('[Seed] Error seeding data:', err.message);
    process.exit(1);
  }

  await pool.end();
  console.log('[Seed] Seed complete.');
}

runSeed();
