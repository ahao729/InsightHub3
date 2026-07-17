const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const config = require('./config');
const { testConnection } = require('./db/pool');
const errorHandlerModule = require('./middleware/errorHandler');
errorHandlerModule.init();
const { errorHandler } = errorHandlerModule;
const { rateLimit } = require('./middleware/rateLimit');

// Route imports
const authRoutes = require('./routes/auth');
const apiKeyRoutes = require('./routes/apiKeys');
const subscriptionRoutes = require('./routes/subscriptions');
const dataPackageRoutes = require('./routes/dataPackages');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const analyzeRoutes = require('./routes/analyze');
const contactRoutes = require('./routes/contact');

const app = express();
const PORT = config.port;

// ============================================================
// Middleware
// ============================================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS - allow frontend dev server
// Defensive: filter out 'null', 'undefined', empty strings to prevent origin spoofing
const allowedOrigins = config.corsOrigins
  .split(',')
  .map(s => s.trim())
  .filter(s => s && s !== 'null' && s !== 'undefined' && s.startsWith('http'));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
}));

// Request logging
app.use(morgan(config.isDev ? 'dev' : 'combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Health Check
// ============================================================

app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();

  res.json({
    success: true,
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus.connected ? 'connected' : 'disconnected',
      memory: process.memoryUsage(),
    }
  });
});

// ============================================================
// API Routes
// ============================================================

const apiRouter = express.Router();

// Global rate limiting for all API routes
apiRouter.use(rateLimit());

// Mount route modules
apiRouter.use('/auth', authRoutes);
apiRouter.use('/api-keys', apiKeyRoutes);
apiRouter.use('/subscriptions', subscriptionRoutes);
apiRouter.use('/data', dataPackageRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/analyze', analyzeRoutes);
apiRouter.use('/contact', contactRoutes);

// Mount all API routes under /api/v1
app.use('/api/v1', apiRouter);

// ============================================================
// 404 Handler
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路径 ${req.method} ${req.path} 不存在。`,
    }
  });
});

// ============================================================
// Global Error Handler
// ============================================================

app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================

async function startServer() {
  // Test database connection
  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log(`[Server] Database connected successfully at ${dbStatus.time}`);
  } else {
    console.warn(`[Server] Database not available: ${dbStatus.error}`);
    console.warn('[Server] Running in fallback mode with in-memory data.');
  }

  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  InsightHub API Server v1.0.0`);
    console.log(`  Running on http://localhost:${PORT}`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Database: ${dbStatus.connected ? '✓ Connected' : '✗ Fallback Mode'}`);
    console.log(`  CORS Origins: ${config.corsOrigins}`);
    console.log(`========================================\n`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  });
}

module.exports = app;
