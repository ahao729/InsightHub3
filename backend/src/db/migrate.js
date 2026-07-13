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

    // 2. Create token_usage table if not exists (aligned with init.sql / tokenUsage.js)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        model VARCHAR(255) NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd DECIMAL(12,6) NOT NULL DEFAULT 0,
        task_type VARCHAR(100) DEFAULT 'general',
        package_code VARCHAR(50),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 2b. Migrate old token_usage schema to new columns (idempotent)
    await pool.query(`
      DO $$
      BEGIN
        -- Add new columns if missing
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'input_tokens'
        ) THEN
          ALTER TABLE token_usage ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'output_tokens'
        ) THEN
          ALTER TABLE token_usage ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'cost_usd'
        ) THEN
          ALTER TABLE token_usage ADD COLUMN cost_usd DECIMAL(12,6) NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'task_type'
        ) THEN
          ALTER TABLE token_usage ADD COLUMN task_type VARCHAR(100) DEFAULT 'general';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'package_code'
        ) THEN
          ALTER TABLE token_usage ADD COLUMN package_code VARCHAR(50);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'timestamp'
        ) THEN
          ALTER TABLE token_usage ADD COLUMN timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE token_usage ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
        -- Backfill from old columns if they exist
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'prompt_tokens'
        ) THEN
          UPDATE token_usage SET input_tokens = prompt_tokens WHERE input_tokens = 0 AND prompt_tokens > 0;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'completion_tokens'
        ) THEN
          UPDATE token_usage SET output_tokens = completion_tokens WHERE output_tokens = 0 AND completion_tokens > 0;
        END IF;
        -- Drop old columns
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'api_key_id'
        ) THEN
          ALTER TABLE token_usage DROP COLUMN api_key_id;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'provider'
        ) THEN
          ALTER TABLE token_usage DROP COLUMN provider;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'prompt_tokens'
        ) THEN
          ALTER TABLE token_usage DROP COLUMN prompt_tokens;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'completion_tokens'
        ) THEN
          ALTER TABLE token_usage DROP COLUMN completion_tokens;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'cost'
        ) THEN
          ALTER TABLE token_usage DROP COLUMN cost;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'endpoint'
        ) THEN
          ALTER TABLE token_usage DROP COLUMN endpoint;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'token_usage' AND column_name = 'metadata'
        ) THEN
          ALTER TABLE token_usage DROP COLUMN metadata;
        END IF;
      END $$;
    `);

    // 3. Create indexes for token_usage (idempotent)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
      CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
      CREATE INDEX IF NOT EXISTS idx_token_usage_task_type ON token_usage(task_type);
      CREATE INDEX IF NOT EXISTS idx_token_usage_package ON token_usage(package_code);
      -- Drop old indexes if they exist
      DROP INDEX IF EXISTS idx_token_usage_api_key_id;
      DROP INDEX IF EXISTS idx_token_usage_created_at;
    `);

    // 4. Add email_verified and verification_token to users if missing
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'email_verified'
        ) THEN
          ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'verification_token'
        ) THEN
          ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
        END IF;
      END $$;
    `);

    // 5. Create password_resets table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
      CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
    `);

    // 6. Add role column to users if missing
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'role'
        ) THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
        END IF;
      END $$;
    `);

    // 7. Mark admin user as email-verified
    await pool.query(`
      UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;
    `);

    // 8. Set admin user role to 'admin'
    await pool.query(`
      UPDATE users SET role = 'admin' WHERE email = 'admin@insighthub.data';
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
