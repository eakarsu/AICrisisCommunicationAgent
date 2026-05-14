const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Prefer user-id as rate limit key (from JWT); fall back to normalized IP
function makeKeyGenerator() {
  return function keyGen(req) {
    const userId = req.user?.id || req.userId;
    if (userId) return String(userId);
    return ipKeyGenerator(req);
  };
}

// 20 AI calls per hour per user
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: makeKeyGenerator(),
  message: {
    error: 'Too many AI requests. Limit is 20 per hour per user. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter — 200 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: makeKeyGenerator(),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiRateLimiter, generalLimiter };
