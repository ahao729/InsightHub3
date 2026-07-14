const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/emailService');

const router = express.Router();

// In-memory fallback store for when DB is unavailable (populated dynamically)
// Cap at 500 users to prevent unbounded memory growth
const MAX_FALLBACK_USERS = 500;
const fallbackUsers = new Map();

// ============================================================
// Helper: generate a secure random token
// ============================================================
function generateToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

// ============================================================
// Helper: build user response object
// ============================================================
function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    email_verified: user.email_verified ?? false,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

// ============================================================
// POST /api/v1/auth/register
// ============================================================
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
    const verificationToken = generateToken();

    try {
      const result = await query(
        `INSERT INTO users (email, name, password_hash, email_verified, verification_token)
         VALUES ($1, $2, $3, FALSE, $4)
         RETURNING id, email, name, email_verified, created_at`,
        [email.toLowerCase(), name, passwordHash, verificationToken]
      );

      const user = result.rows[0];

      // Send verification email (non-blocking)
      sendVerificationEmail(user.email, verificationToken, user.name).catch(err => {
        console.warn('[Auth] Failed to send verification email:', err.message);
      });

      const token = jwt.sign(
        { sub: user.id, email: user.email, name: user.name },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      return res.status(201).json({
        success: true,
        data: {
          user: userResponse(user),
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

        if (fallbackUsers.size >= MAX_FALLBACK_USERS) {
          return res.status(503).json({
            success: false,
            error: { code: 'SERVICE_UNAVAILABLE', message: '注册服务暂时不可用，请稍后重试。' }
          });
        }

        const newUser = {
          id: uuidv4(),
          email: email.toLowerCase(),
          name,
          password_hash: passwordHash,
          email_verified: false,
          verification_token: verificationToken,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        fallbackUsers.set(newUser.email, newUser);

        // Try sending verification email in fallback too
        sendVerificationEmail(newUser.email, verificationToken, newUser.name).catch(() => {});

        const token = jwt.sign(
          { sub: newUser.id, email: newUser.email, name: newUser.name },
          config.jwtSecret,
          { expiresIn: config.jwtExpiresIn }
        );

        return res.status(201).json({
          success: true,
          data: {
            user: userResponse(newUser),
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

// ============================================================
// POST /api/v1/auth/login
// ============================================================
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
        'SELECT id, email, name, password_hash, email_verified FROM users WHERE email = $1',
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
          user: userResponse(user),
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
            user: userResponse(user),
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

// ============================================================
// GET /api/v1/auth/me
// ============================================================
router.get('/me', authenticate, async (req, res, next) => {
  try {
    try {
      const result = await query(
        'SELECT id, email, name, email_verified, created_at, updated_at FROM users WHERE id = $1',
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
        data: { user: userResponse(result.rows[0]) }
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
        data: { user: userResponse(user) }
      });
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PUT /api/v1/auth/me
// ============================================================
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
      // If email changes, reset verification
      updates.push(`email_verified = FALSE`);
    }
    updates.push(`updated_at = NOW()`);
    params.push(req.user.id);

    try {
      const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, email, name, email_verified, created_at, updated_at`,
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
        data: { user: userResponse(result.rows[0]) }
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
      if (email) {
        user.email = email.toLowerCase();
        user.email_verified = false;
      }
      user.updated_at = new Date().toISOString();

      return res.json({
        success: true,
        data: { user: userResponse(user) }
      });
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/v1/auth/forgot-password
// Generates a reset token, saves it to DB, and sends reset email.
// Always returns success (no user enumeration).
// ============================================================
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供邮箱地址。' }
      });
    }

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + config.passwordReset.expiryMinutes * 60 * 1000);

    try {
      // Find user
      const userResult = await query(
        'SELECT id, email, name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];

        // Invalidate any existing unused tokens for this user
        await query(
          'UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND used = FALSE',
          [user.id]
        );

        // Save new reset token
        await query(
          `INSERT INTO password_resets (user_id, token, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, resetToken, expiresAt]
        );

        // Send email (non-blocking)
        sendPasswordResetEmail(user.email, resetToken, user.name).catch(err => {
          console.warn('[Auth] Failed to send reset email:', err.message);
        });
      }
      // Always return success to prevent user enumeration
    } catch (dbErr) {
      // DB unavailable - fallback: just log the token
      if (dbErr.code === 'ECONNREFUSED' || dbErr.code === 'ENOTFOUND' || dbErr.code === '57P01') {
        console.warn('[Auth] DB unavailable for forgot-password, using fallback');
        const user = Array.from(fallbackUsers.values()).find(u => u.email === email.toLowerCase());
        if (user) {
          user._resetToken = resetToken;
          user._resetExpires = expiresAt;
          sendPasswordResetEmail(user.email, resetToken, user.name).catch(() => {});
        }
      } else {
        console.warn('[Auth] forgot-password DB error:', dbErr.message);
      }
      // Always return success
    }

    return res.json({
      success: true,
      data: { message: '如果该邮箱已注册，你将收到一封重置密码邮件。' }
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/v1/auth/reset-password
// Validates the reset token and sets the new password.
// ============================================================
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供重置令牌和新密码。' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '密码长度至少为6位。' }
      });
    }

    try {
      // Find the reset token
      const resetResult = await query(
        `SELECT pr.id, pr.user_id, pr.expires_at, pr.used,
                u.email, u.name
         FROM password_resets pr
         JOIN users u ON u.id = pr.user_id
         WHERE pr.token = $1 AND pr.used = FALSE
         ORDER BY pr.created_at DESC
         LIMIT 1`,
        [token]
      );

      if (resetResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: '重置令牌无效或已使用。' }
        });
      }

      const reset = resetResult.rows[0];

      // Check expiry
      if (new Date(reset.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: '重置令牌已过期，请重新申请。' }
        });
      }

      // Hash new password and update
      const passwordHash = await bcrypt.hash(password, 10);

      await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, reset.user_id]
      );

      // Mark token as used
      await query(
        'UPDATE password_resets SET used = TRUE WHERE id = $1',
        [reset.id]
      );

      // Invalidate all other reset tokens for this user
      await query(
        'UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND id != $2',
        [reset.user_id, reset.id]
      );

      return res.json({
        success: true,
        data: { message: '密码重置成功，请使用新密码登录。' }
      });
    } catch (dbErr) {
      // Fallback for no DB
      if (dbErr.code === 'ECONNREFUSED' || dbErr.code === 'ENOTFOUND' || dbErr.code === '57P01') {
        console.warn('[Auth] DB unavailable for reset-password, using fallback');
        const user = Array.from(fallbackUsers.values()).find(
          u => u._resetToken === token && u._resetExpires && new Date(u._resetExpires) > new Date()
        );
        if (user) {
          user.password_hash = await bcrypt.hash(password, 10);
          delete user._resetToken;
          delete user._resetExpires;
          return res.json({
            success: true,
            data: { message: '密码重置成功，请使用新密码登录。' }
          });
        }
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: '重置令牌无效或已使用。' }
        });
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/v1/auth/send-verification
// (Requires authentication) Sends a new verification email.
// ============================================================
router.post('/send-verification', authenticate, async (req, res, next) => {
  try {
    try {
      const userResult = await query(
        'SELECT id, email, name, email_verified FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }

      const user = userResult.rows[0];

      if (user.email_verified) {
        return res.json({
          success: true,
          data: { message: '你的邮箱已验证。' }
        });
      }

      // Generate new verification token
      const verificationToken = generateToken();
      await query(
        'UPDATE users SET verification_token = $1, updated_at = NOW() WHERE id = $2',
        [verificationToken, user.id]
      );

      // Send email (non-blocking)
      sendVerificationEmail(user.email, verificationToken, user.name).catch(err => {
        console.warn('[Auth] Failed to send verification email:', err.message);
      });

      return res.json({
        success: true,
        data: { message: '验证邮件已发送，请查收。' }
      });
    } catch (dbErr) {
      if (dbErr.code === 'ECONNREFUSED' || dbErr.code === 'ENOTFOUND' || dbErr.code === '57P01') {
        // Fallback
        const user = Array.from(fallbackUsers.values()).find(u => u.id === req.user.id);
        if (user) {
          const verificationToken = generateToken();
          user.verification_token = verificationToken;
          sendVerificationEmail(user.email, verificationToken, user.name).catch(() => {});
          return res.json({
            success: true,
            data: { message: '验证邮件已发送，请查收。' }
          });
        }
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/v1/auth/verify-email
// Validates the email verification token.
// ============================================================
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供验证令牌。' }
      });
    }

    try {
      const result = await query(
        'UPDATE users SET email_verified = TRUE, verification_token = NULL, updated_at = NOW() WHERE verification_token = $1 AND email_verified = FALSE RETURNING id, email, name',
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: '验证令牌无效或邮箱已验证。' }
        });
      }

      return res.json({
        success: true,
        data: { message: '邮箱验证成功！' }
      });
    } catch (dbErr) {
      if (dbErr.code === 'ECONNREFUSED' || dbErr.code === 'ENOTFOUND' || dbErr.code === '57P01') {
        // Fallback
        const user = Array.from(fallbackUsers.values()).find(
          u => u.verification_token === token && !u.email_verified
        );
        if (user) {
          user.email_verified = true;
          user.verification_token = null;
          return res.json({
            success: true,
            data: { message: '邮箱验证成功！' }
          });
        }
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: '验证令牌无效或邮箱已验证。' }
        });
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// Test-only: clear fallback in-memory stores between tests
router._clearFallbackUsers = () => {
  fallbackUsers.clear();
};

module.exports = router;
