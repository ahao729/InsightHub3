const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT Auth Middleware
 * Extracts and verifies Bearer token, attaches user to req.user
 * Also supports API key authentication via X-API-Key header
 */

// In-memory fallback store for when DB is unavailable
const apiKeyCache = new Map();

function authenticate(req, res, next) {
  // Check for API key first
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return authenticateApiKey(apiKey, req, res, next);
  }

  // Check for Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '缺少认证凭证。请提供有效的Bearer token或API Key。'
      }
    });
  }

  const token = authHeader.substring(7);
  return authenticateJwt(token, req, res, next);
}

function authenticateJwt(token, req, res, next) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role || 'user',
      authType: 'jwt',
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token已过期，请重新登录。'
        }
      });
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: '无效的认证凭证。'
      }
    });
  }
}

function authenticateApiKey(key, req, res, next) {
  // Check in-memory cache first
  const cached = apiKeyCache.get(key);
  if (cached) {
    req.user = {
      id: cached.user_id,
      name: cached.name,
      authType: 'api_key',
      apiKey: key,
    };
    return next();
  }

  // If DB is available, check there
  const pool = require('../db/pool');
  pool.query(
    `SELECT u.id, u.email, u.name, ak.key
     FROM api_keys ak
     JOIN users u ON u.id = ak.user_id
     WHERE ak.key = $1 AND ak.revoked = FALSE`,
    [key]
  )
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: '无效或已撤销的API Key。'
          }
        });
      }

      const row = result.rows[0];
      // Update last_used_at (fire-and-forget)
      pool.query(
        'UPDATE api_keys SET last_used_at = NOW() WHERE key = $1',
        [key]
      ).catch(() => {});

      req.user = {
        id: row.id,
        email: row.email,
        name: row.name,
        authType: 'api_key',
        apiKey: key,
      };
      next();
    })
    .catch(() => {
      // DB error - try fallback
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_UNAVAILABLE',
          message: '认证服务暂时不可用，请稍后再试。'
        }
      });
    });
}

/**
 * Optional auth - attaches user if token present, but doesn't fail if not
 */
function optionalAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;

  if (apiKey) {
    return authenticateApiKey(apiKey, req, res, (err) => {
      if (res.headersSent) return;
      next();
    });
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = {
        id: decoded.sub || decoded.id,
        email: decoded.email,
        name: decoded.name,
        authType: 'jwt',
      };
    } catch (e) {
      // Token invalid, continue without user
    }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
