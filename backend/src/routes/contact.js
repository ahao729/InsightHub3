const express = require('express');
const { query } = require('../db/pool');
const config = require('../config');
const nodemailer = require('nodemailer');

const router = express.Router();

// ── In-memory fallback store ──
const fallbackContacts = [];

// ── POST /api/v1/contact ──
router.post('/', async (req, res, next) => {
  try {
    const { name, email, description } = req.body;

    // ── Validate ──
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请输入有效的邮箱地址。' },
      });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请描述你的数据需求（至少 2 个字符）。' },
      });
    }
    const safeName = (name || '').trim().slice(0, 100) || '匿名用户';
    const safeEmail = email.trim().toLowerCase().slice(0, 255);
    const safeDesc = description.trim().slice(0, 5000);

    // ── Persist ──
    try {
      await query(
        `INSERT INTO contact_requests (name, email, description, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [safeName, safeEmail, safeDesc]
      );
    } catch {
      // DB not available → in-memory fallback
      fallbackContacts.push({
        id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: safeName,
        email: safeEmail,
        description: safeDesc,
        created_at: new Date().toISOString(),
      });
      console.log('[Contact] Saved to in-memory fallback (DB unavailable)');
    }

    // ── Send notification email (if SMTP configured) ──
    if (config.email.user && config.email.pass) {
      try {
        const transporter = nodemailer.createTransport({
          host: config.email.host,
          port: config.email.port,
          secure: config.email.secure,
          auth: { user: config.email.user, pass: config.email.pass },
        });

        await transporter.sendMail({
          from: config.email.from,
          to: config.email.from,
          replyTo: safeEmail,
          subject: `[InsightHub] 新的数据需求 - ${safeName}`,
          text: [
            `姓名: ${safeName}`,
            `邮箱: ${safeEmail}`,
            `描述:`,
            safeDesc,
            `---`,
            `发送时间: ${new Date().toISOString()}`,
          ].join('\n'),
        });
      } catch (emailErr) {
        // Silent fail – email notification is best-effort
        console.warn('[Contact] Failed to send notification email:', emailErr.message);
      }
    }

    // ── Success response ──
    res.status(201).json({
      success: true,
      data: { message: '感谢提交！我们将在 48 小时内通过邮件回复你的需求。' },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
