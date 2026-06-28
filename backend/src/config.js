require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/insighthub',
  jwtSecret: process.env.JWT_SECRET || 'insighthub-dev-secret-key-change-in-production',
  jwtExpiresIn: '7d',
  corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:3000',
  adminInviteCode: process.env.ADMIN_INVITE_CODE || 'INSIGHTHUB2024',
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};

module.exports = config;
