/**
 * Migration Runner
 * Reads schema.sql and executes it, then seeds initial data.
 * Run: node src/db/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config');

async function runMigration() {
  console.log('[Migrate] Starting database migration...');

  // Connect without database first to create if needed
  const baseUrl = config.databaseUrl;
  const dbName = baseUrl.split('/').pop();
  const adminUrl = baseUrl.replace(`/${dbName}`, '/postgres');

  let adminPool;
  try {
    adminPool = new Pool({ connectionString: adminUrl });
    const res = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
    );
    if (res.rows.length === 0) {
      console.log(`[Migrate] Creating database "${dbName}"...`);
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[Migrate] Database "${dbName}" created.`);
    } else {
      console.log(`[Migrate] Database "${dbName}" already exists.`);
    }
    await adminPool.end();
  } catch (err) {
    console.warn('[Migrate] Could not check/create database:', err.message);
    console.warn('[Migrate] Continuing assuming database exists...');
  }

  // Now run schema against the actual database
  const pool = new Pool({ connectionString: config.databaseUrl });

  try {
    const schemaPath = path.join(__dirname, '../../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('[Migrate] Executing schema.sql...');
    await pool.query(schemaSql);
    console.log('[Migrate] Schema applied successfully.');
  } catch (err) {
    console.error('[Migrate] Error applying schema:', err.message);
    console.warn('[Migrate] Schema may have partial changes. Continuing...');
  }

  // Seed data
  try {
    const seedPath = path.join(__dirname, '../../seed/seed_data.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      console.log('[Migrate] Seeding data...');
      await pool.query(seedSql);
      console.log('[Migrate] Seed data inserted.');
    } else {
      console.log('[Migrate] No seed_data.sql found, skipping seed.');
    }
  } catch (err) {
    console.error('[Migrate] Error seeding data:', err.message);
  }

  await pool.end();
  console.log('[Migrate] Migration complete.');
}

runMigration().catch((err) => {
  console.error('[Migrate] Migration failed:', err);
  process.exit(1);
});
