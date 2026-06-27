const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// In-memory fallback
const fallbackKeys = new Map();
// Pre-seeded dev keys
fallbackKeys.set('sk-dev-admin', {
  id: 'key-admin-001',
  user_id: 'dev-admin-id',
  key: 'sk-dev-admin',
  name: '管理密钥',
  last_used_at: null,
  created_at: new Date().toISOString(),
  revoked: false,
});
fallbackKeys.set('sk-dev-demo', {
  id: 'key-demo-001',
  user_id: 'dev-demo-id',
  key: 'sk-dev-demo',
  name: 'Demo密钥',
  last_used_at: null,
  created_at: new Date().toISOString(),
  revoked: false,
});

function generateApiKey() {
  return 'sk-' + crypto.randomBytes(24).toString('hex');
}

// GET /api/v1/api-keys - List user's keys
router.get('/', authenticate, async (req, res, next) => {
  try {
    try {
      const result = await query(
        `SELECT id, key, name, last_used_at, created_at, revoked
         FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.user.id]
      );
      return res.json({
        success: true,
        data: result.rows,
        meta: { total: result.rows.length }
      });
    } catch (dbErr) {
      // Fallback
      const keys = Array.from(fallbackKeys.values())
        .filter(k => k.user_id === req.user.id && !k.revoked);
      return res.json({
        success: true,
        data: keys,
        meta: { total: keys.length }
      });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/api-keys - Create new key
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供密钥名称。' }
      });
    }

    const apiKey = generateApiKey();

    try {
      const result = await query(
        `INSERT INTO api_keys (user_id, key, name) VALUES ($1, $2, $3)
         RETURNING id, key, name, created_at, revoked`,
        [req.user.id, apiKey, name]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (dbErr) {
      // Fallback
      const newKey = {
        id: uuidv4(),
        user_id: req.user.id,
        key: apiKey,
        name,
        last_used_at: null,
        created_at: new Date().toISOString(),
        revoked: false,
      };
      fallbackKeys.set(apiKey, newKey);

      return res.status(201).json({
        success: true,
        data: newKey
      });
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/api-keys/:id - Revoke key
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    try {
      const result = await query(
        `UPDATE api_keys SET revoked = TRUE WHERE id = $1 AND user_id = $2
         RETURNING id, key, name, revoked`,
        [req.params.id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'API Key不存在或不属于当前用户。' }
        });
      }

      return res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (dbErr) {
      // Fallback
      const key = Array.from(fallbackKeys.values())
        .find(k => k.id === req.params.id && k.user_id === req.user.id);

      if (!key) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'API Key不存在或不属于当前用户。' }
        });
      }

      key.revoked = true;
      return res.json({
        success: true,
        data: { id: key.id, key: key.key, name: key.name, revoked: true }
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
