const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// In-memory fallback store for when DB is unavailable (populated dynamically)
const fallbackUsers = new Map();

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供邮箱、密码和用户名。' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '密码长度至少为6位。' }
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const result = await query(
        `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
         RETURNING id, email, name, created_at`,
        [email.toLowerCase(), name, passwordHash]
      );

      const user = result.rows[0];
      const token = jwt.sign(
        { sub: user.id, email: user.email, name: user.name },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      return res.status(201).json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          token,
        }
      });
    } catch (dbErr) {
      if (dbErr.code === '23505') {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_ENTRY', message: '该邮箱已被注册。' }
        });
      }

      // DB unavailable - fallback to in-memory
      if (dbErr.code === 'ECONNREFUSED' || dbErr.code === 'ENOTFOUND' || dbErr.code === '57P01') {
        console.warn('[Auth] DB unavailable, using fallback store');
        if (fallbackUsers.has(email.toLowerCase())) {
          return res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE_ENTRY', message: '该邮箱已被注册。' }
          });
        }

        const newUser = {
          id: uuidv4(),
          email: email.toLowerCase(),
          name,
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        fallbackUsers.set(newUser.email, newUser);

        const token = jwt.sign(
          { sub: newUser.id, email: newUser.email, name: newUser.name },
          config.jwtSecret,
          { expiresIn: config.jwtExpiresIn }
        );

        return res.status(201).json({
          success: true,
          data: {
            user: { id: newUser.id, email: newUser.email, name: newUser.name },
            token,
          }
        });
      }

      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供邮箱和密码。' }
      });
    }

    try {
      const result = await query(
        'SELECT id, email, name, password_hash FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' }
        });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' }
        });
      }

      const token = jwt.sign(
        { sub: user.id, email: user.email, name: user.name },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      return res.json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          token,
        }
      });
    } catch (dbErr) {
      // DB unavailable - check fallback
      if (dbErr.code === 'ECONNREFUSED' || dbErr.code === 'ENOTFOUND' || dbErr.code === '57P01') {
        console.warn('[Auth] DB unavailable, using fallback store');
        const user = fallbackUsers.get(email.toLowerCase());
        if (!user) {
          return res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' }
          });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
          return res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' }
          });
        }

        const token = jwt.sign(
          { sub: user.id, email: user.email, name: user.name },
          config.jwtSecret,
          { expiresIn: config.jwtExpiresIn }
        );

        return res.json({
          success: true,
          data: {
            user: { id: user.id, email: user.email, name: user.name },
            token,
          }
        });
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    try {
      const result = await query(
        'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }

      return res.json({
        success: true,
        data: { user: result.rows[0] }
      });
    } catch (dbErr) {
      // Fallback
      const user = Array.from(fallbackUsers.values()).find(u => u.id === req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }
      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            created_at: user.created_at,
            updated_at: user.updated_at,
          }
        }
      });
    }
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/auth/me
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供要更新的字段。' }
      });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (email) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email.toLowerCase());
    }
    updates.push(`updated_at = NOW()`);
    params.push(req.user.id);

    try {
      const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, email, name, created_at, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }

      return res.json({
        success: true,
        data: { user: result.rows[0] }
      });
    } catch (dbErr) {
      if (dbErr.code === '23505') {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_ENTRY', message: '该邮箱已被使用。' }
        });
      }

      // Fallback update
      const user = Array.from(fallbackUsers.values()).find(u => u.id === req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }

      if (name) user.name = name;
      if (email) user.email = email.toLowerCase();
      user.updated_at = new Date().toISOString();

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            created_at: user.created_at,
            updated_at: user.updated_at,
          }
        }
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
