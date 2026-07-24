const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { query } = require('../db/pool');

const router = express.Router();

// ============================================================
// In-memory fallback for OAuth users when DB is unavailable
// ============================================================
const fallbackUsers = new Map();

// ============================================================
// Helper: find or create user by OAuth profile
// ============================================================
async function findOrCreateOAuthUser(profile) {
  const email = profile.email.toLowerCase();

  // Try DB first
  try {
    // Look up existing user by email
    const result = await query(
      'SELECT id, email, name, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length > 0) {
      // User exists — update name if changed, mark email verified
      const user = result.rows[0];
      if (!user.email_verified) {
        await query(
          'UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1',
          [user.id]
        );
        user.email_verified = true;
      }
      return user;
    }

    // Create new user (random password hash — OAuth users don't need a password)
    const randomHash = await require('bcryptjs').hash(crypto.randomBytes(32).toString('hex'), 4);
    const insertResult = await query(
      `INSERT INTO users (email, name, password_hash, email_verified)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, email, name, email_verified, created_at`,
      [email, profile.name, randomHash]
    );

    return insertResult.rows[0];
  } catch (dbErr) {
    // DB unavailable — fallback to in-memory
    if (dbErr.code === 'ECONNREFUSED' || dbErr.code === 'ENOTFOUND' || dbErr.code === '57P01') {
      console.warn('[OAuth] DB unavailable, using fallback store');

      if (fallbackUsers.has(email)) {
        return fallbackUsers.get(email);
      }

      const newUser = {
        id: uuidv4(),
        email,
        name: profile.name,
        email_verified: true,
        created_at: new Date().toISOString(),
      };
      fallbackUsers.set(email, newUser);
      return newUser;
    }
    throw dbErr;
  }
}

// ============================================================
// Helper: generate JWT for user
// ============================================================
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// ============================================================
// Helper: redirect to frontend with token + optional redirect
// ============================================================
function redirectWithToken(res, token, redirectPath) {
  const base = config.oauth.frontendUrl;
  const params = new URLSearchParams({ oauth_token: token });
  if (redirectPath) params.set('redirect', redirectPath);
  res.redirect(`${base}/auth.html?${params.toString()}`);
}

// ============================================================
// Helper: build frontend redirect URL for a given provider
// ============================================================
function getFrontendRedirectUrl() {
  return config.oauth.frontendUrl;
}

// ============================================================
// GET /api/v1/auth/oauth/google — initiate Google OAuth
// ============================================================
router.get('/google', (req, res) => {
  const { clientId } = config.oauth.google;
  if (!clientId) {
    return res.status(503).json({
      success: false,
      error: { code: 'OAUTH_UNAVAILABLE', message: 'Google 登录未配置。' }
    });
  }

  const redirectUri = `${config.oauth.backendUrl}/api/v1/auth/oauth/google/callback`;
  const state = req.query.redirect || '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// ============================================================
// GET /api/v1/auth/oauth/google/callback — handle Google callback
// ============================================================
router.get('/google/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return redirectWithToken(res, '', '');
    }
    if (!code) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CODE', message: '授权码缺失。' }
      });
    }

    const { clientId, clientSecret } = config.oauth.google;
    const redirectUri = `${config.oauth.backendUrl}/api/v1/auth/oauth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('[OAuth:Google] Token exchange failed:', tokenData);
      return res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_error=token_exchange_failed`);
    }

    // Fetch user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.email) {
      return res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_error=no_email`);
    }

    // Find or create user
    const user = await findOrCreateOAuthUser({
      email: googleUser.email,
      name: googleUser.name || googleUser.email.split('@')[0],
    });

    // Generate JWT and redirect
    const token = signToken(user);
    const redirect = req.query.state || '';
    res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`);
  } catch (err) {
    console.error('[OAuth:Google] Callback error:', err);
    res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_error=server_error`);
  }
});

// ============================================================
// GET /api/v1/auth/oauth/github — initiate GitHub OAuth
// ============================================================
router.get('/github', (req, res) => {
  const { clientId } = config.oauth.github;
  if (!clientId) {
    return res.status(503).json({
      success: false,
      error: { code: 'OAUTH_UNAVAILABLE', message: 'GitHub 登录未配置。' }
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'read:user user:email',
  });
  const state = req.query.redirect || '';
  if (state) params.set('state', state);

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// ============================================================
// GET /api/v1/auth/oauth/github/callback — handle GitHub callback
// ============================================================
router.get('/github/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_error=denied`);
    }
    if (!code) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CODE', message: '授权码缺失。' }
      });
    }

    const { clientId, clientSecret } = config.oauth.github;

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('[OAuth:GitHub] Token exchange failed:', tokenData);
      return res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_error=token_exchange_failed`);
    }

    // Fetch user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const githubUser = await userRes.json();

    if (!githubUser.login) {
      return res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_error=no_user`);
    }

    // Fetch user emails (primary email may be private)
    let email = githubUser.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      const emails = await emailsRes.json();
      if (Array.isArray(emails)) {
        const primary = emails.find(e => e.primary && e.verified);
        email = primary ? primary.email : (emails.find(e => e.verified) || {}).email;
      }
    }

    if (!email) {
      return res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_error=no_email`);
    }

    // Find or create user
    const user = await findOrCreateOAuthUser({
      email,
      name: githubUser.name || githubUser.login,
    });

    // Generate JWT and redirect
    const token = signToken(user);
    const redirect = req.query.state || '';
    res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`);
  } catch (err) {
    console.error('[OAuth:GitHub] Callback error:', err);
    res.redirect(`${config.oauth.frontendUrl}/auth.html?oauth_error=server_error`);
  }
});

// ============================================================
// GET /api/v1/auth/oauth/status — check which providers are configured
// ============================================================
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      google: !!config.oauth.google.clientId,
      github: !!config.oauth.github.clientId,
    }
  });
});

module.exports = router;
