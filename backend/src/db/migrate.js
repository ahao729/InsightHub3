/**
 * Migration Runner
 * Reads schema.sql and executes it, then seeds initial data.
 * Run: node src/db/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
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
  // Apply incremental migrations for existing databases
  try {
    console.log('[Migrate] Running incremental migrations...');

    // 1. Add updated_at to api_keys if missing
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'api_keys' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE api_keys ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
      END $$;
    `);

    // 2. Create token_usage table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        model VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL DEFAULT 'openai',
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        cost NUMERIC(10,6) NOT NULL DEFAULT 0,
        endpoint VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 3. Create indexes for token_usage (idempotent)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_api_key_id ON token_usage(api_key_id);
      CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
      CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
    `);

    console.log('[Migrate] Incremental migrations applied.');
  } catch (err) {
    console.warn('[Migrate] Incremental migration warning:', err.message);
  }

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

  // Seed default admin user
  try {
    const adminEmail = 'admin@insighthub.data';
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    if (existingAdmin.rows.length === 0) {
      const adminPasswordHash = await bcrypt.hash('admin123456', 10);
      await pool.query(
        'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)',
        [adminEmail, '管理员', adminPasswordHash]
      );
      console.log('[Migrate] Default admin user created: admin@insighthub.data');
    } else {
      console.log('[Migrate] Admin user already exists, skipping.');
    }
  } catch (err) {
    console.warn('[Migrate] Could not seed admin user:', err.message);
  }

  await pool.end();
  console.log('[Migrate] Migration complete.');
}

runMigration().catch((err) => {
  console.error('[Migrate] Migration failed:', err);
  process.exit(1);
});
