'use strict';

const crypto = require('crypto');

/**
 * Compute HMAC-SHA256 of payload using the given secret, returned as hex.
 */
function hmac(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * requireAuth middleware
 *
 * Reads the `auth_token` cookie and verifies its HMAC-SHA256 signature.
 * Cookie format: `<payload>.<signature>` where signature = HMAC-SHA256(payload, COOKIE_SECRET) as hex.
 *
 * Calls next() on success; returns 401 { error: 'Unauthorized' } on missing or invalid cookie.
 *
 * Requirements: 1.4, 1.5
 */
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const expected = hmac(payload, secret);

  // Use timingSafeEqual to prevent timing attacks
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = requireAuth;
module.exports.hmac = hmac;
