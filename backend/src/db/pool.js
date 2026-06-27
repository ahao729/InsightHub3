const { Pool } = require('pg');
const config = require('../config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function testConnection() {
  try {
    const client = await getPool().connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    return { connected: true, time: result.rows[0].current_time };
  } catch (err) {
    console.warn('[DB] Connection test failed:', err.message);
    return { connected: false, error: err.message };
  }
}

module.exports = { getPool, query, testConnection };
