const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { NotFoundError } = require('../middleware/errorHandler');

// Load all package services
const startupIntel = require('../services/startupIntel');
const enterpriseRisk = require('../services/enterpriseRisk');
const financeMacro = require('../services/financeMacro');
const patentTech = require('../services/patentTech');
const policyBidding = require('../services/policyBidding');
const aiGeo = require('../services/aiGeo');
const education = require('../services/education');
const web3Crypto = require('../services/web3Crypto');
const crossborderEcommerce = require('../services/crossborderEcommerce');

const router = express.Router();

// Map of package code to service module
const packageServices = {
  'startup-intel': startupIntel,
  'enterprise-risk': enterpriseRisk,
  'finance-macro': financeMacro,
  'patent-tech': patentTech,
  'policy-bidding': policyBidding,
  'ai-geo': aiGeo,
  'education': education,
  'web3-crypto': web3Crypto,
  'crossborder-ecommerce': crossborderEcommerce,
};

const validPackages = Object.keys(packageServices);

// Package name mapping for display
const packageNames = {
  'startup-intel': '创业商业情报',
  'enterprise-risk': '企业风控',
  'finance-macro': '金融宏观',
  'patent-tech': '专利科技',
  'policy-bidding': '政策招投标',
  'ai-geo': 'AI / GEO 分析',
  'education': '教育',
  'web3-crypto': 'Web3 / Crypto',
  'crossborder-ecommerce': '跨境电商',
};

/**
 * Middleware to resolve package and attach service to req
 */
function resolvePackage(req, res, next) {
  const { package: pkg } = req.params;

  if (!validPackages.includes(pkg)) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'INVALID_PACKAGE',
        message: `未知的数据包: "${pkg}"。有效数据包: ${validPackages.join(', ')}`,
      }
    });
  }

  req.packageService = packageServices[pkg];
  req.packageName = packageNames[pkg];
  req.packageCode = pkg;
  next();
}

/**
 * Helper to build paginated response
 */
function paginatedResponse(data, total, page = 1, limit = 20) {
  return {
    success: true,
    data,
    meta: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    }
  };
}

// ============================================================
// Routes
// ============================================================

// GET /api/v1/data/:package/stats - Package statistics
router.get('/:package/stats', optionalAuth, resolvePackage, async (req, res, next) => {
  try {
    const stats = await req.packageService.getStats();
    return res.json({
      success: true,
      data: {
        package: req.packageCode,
        packageName: req.packageName,
        ...stats,
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/data/:package/search - Search endpoint
router.get('/:package/search', optionalAuth, resolvePackage, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const result = await req.packageService.search(req.query, { page, limit });

    if (!result) {
      return res.json(paginatedResponse([], 0, page, limit));
    }

    return res.json(paginatedResponse(result.data, result.total, page, limit));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/data/:package/:id - Get single item
router.get('/:package/:id', optionalAuth, resolvePackage, async (req, res, next) => {
  try {
    const item = await req.packageService.getById(req.params.id);

    if (!item) {
      throw new NotFoundError(`未找到ID为 "${req.params.id}" 的数据。`);
    }

    return res.json({
      success: true,
      data: item,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.validPackages = validPackages;
module.exports.packageNames = packageNames;
