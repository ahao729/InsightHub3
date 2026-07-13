/**
 * InsightHub Data — Email Service
 * Handles sending emails for password reset and email verification.
 * In development mode, emails are logged to console instead of actually sent.
 */

const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (config.email.devMode) {
    // In dev mode, just log emails to console
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  return transporter;
}

/**
 * Send an email (or log in dev mode)
 */
async function sendEmail(to, subject, htmlBody) {
  const transport = getTransporter();

  const mailOptions = {
    from: config.email.from,
    to,
    subject,
    html: htmlBody,
  };

  if (!transport) {
    // Dev mode: log to console
    console.log('\n========================================');
    console.log('[DEV EMAIL] To:', to);
    console.log('[DEV EMAIL] Subject:', subject);
    console.log('[DEV EMAIL] Body (HTML):');
    console.log(htmlBody);
    console.log('========================================\n');
    return { devMode: true, to, subject };
  }

  const info = await transport.sendMail(mailOptions);
  console.log('[Email] Message sent:', info.messageId);
  return info;
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(to, resetToken, userName) {
  const resetUrl = `${config.email.frontendUrl}/auth.html?reset_token=${resetToken}`;

  const subject = 'InsightHub - 重置密码';
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="margin-bottom: 24px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #4C6EF5; display: inline-block;"></div>
        <span style="font-size: 15px; font-weight: 500; margin-left: 8px;">InsightHub Data</span>
      </div>
      <h2 style="font-size: 18px; font-weight: 500; margin-bottom: 16px;">重置你的密码</h2>
      <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px;">
        你好${userName ? ' ' + userName : ''}，我们收到了你的密码重置请求。请点击下方链接重置密码：
      </p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 24px; background: #4C6EF5; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 24px;">
        重置密码
      </a>
      <p style="font-size: 12px; color: #999; line-height: 1.6;">
        此链接将在 ${config.passwordReset.expiryMinutes} 分钟后失效。如果这不是你的操作，请忽略此邮件。
      </p>
    </div>
  `;

  return sendEmail(to, subject, htmlBody);
}

/**
 * Send email verification email
 */
async function sendVerificationEmail(to, verifyToken, userName) {
  const verifyUrl = `${config.email.frontendUrl}/auth.html?verify_token=${verifyToken}`;

  const subject = 'InsightHub - 验证你的邮箱';
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="margin-bottom: 24px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #4C6EF5; display: inline-block;"></div>
        <span style="font-size: 15px; font-weight: 500; margin-left: 8px;">InsightHub Data</span>
      </div>
      <h2 style="font-size: 18px; font-weight: 500; margin-bottom: 16px;">验证你的邮箱</h2>
      <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px;">
        ${userName ? '你好 ' + userName + '，' : '你好，'}欢迎注册 InsightHub Data！请点击下方链接完成邮箱验证：
      </p>
      <a href="${verifyUrl}" style="display: inline-block; padding: 10px 24px; background: #4C6EF5; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 24px;">
        验证邮箱
      </a>
      <p style="font-size: 12px; color: #999; line-height: 1.6;">
        如果这不是你的操作，请忽略此邮件。
      </p>
    </div>
  `;

  return sendEmail(to, subject, htmlBody);
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
};
