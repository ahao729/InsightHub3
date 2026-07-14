const rateLimit = require('express-rate-limit');

/**
 * 登录接口限流：每 IP 每 15 分钟最多 5 次尝试
 * 防暴力破解
 */
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: '登录尝试次数过多，请 15 分钟后重试。'
      }
    });
  },
  skipSuccessfulRequests: false
});

/**
 * 注册接口限流：每 IP 每小时最多 3 次尝试
 * 防批量注册滥用
 */
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: '注册尝试次数过多，请 1 小时后重试。'
      }
    });
  },
  skipSuccessfulRequests: false
});

module.exports = { loginRateLimit, registerRateLimit };
