/**
 * Global Error Handler Middleware
 */

function errorHandler(err, req, res, _next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  // Determine status code
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = '服务器内部错误，请稍后再试。';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message || '请求参数验证失败。';
  } else if (err.name === 'NotFoundError' || statusCode === 404) {
    errorCode = 'NOT_FOUND';
    message = err.message || '请求的资源不存在。';
  } else if (err.name === 'UnauthorizedError' || statusCode === 401) {
    errorCode = 'UNAUTHORIZED';
    message = err.message || '未授权的访问。';
  } else if (err.name === 'ForbiddenError' || statusCode === 403) {
    errorCode = 'FORBIDDEN';
    message = err.message || '没有权限执行此操作。';
  } else if (err.code === '23505') {
    // PostgreSQL unique violation
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = '该记录已存在。';
  }

  if (statusCode === 500 && (config && config.isDev)) {
    message = err.message || message;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(config && config.isDev && { details: err.stack }),
    }
  });
}

// Use lazy require to avoid circular dependency
let config = null;
Object.defineProperty(module.exports, 'init', {
  value: () => {
    config = require('../config');
  },
  writable: false,
});

module.exports.errorHandler = errorHandler;

// Convenience error classes
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

module.exports.ValidationError = ValidationError;
module.exports.NotFoundError = NotFoundError;
module.exports.UnauthorizedError = UnauthorizedError;
module.exports.ForbiddenError = ForbiddenError;
