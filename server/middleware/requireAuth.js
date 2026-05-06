'use strict';

/**
 * requireAuth middleware
 *
 * Checks that the `auth_token` cookie is present and equals the expected value
 * (AUTH_USERNAME:AUTH_PASSWORD encoded as base64).
 *
 * Calls next() on success; returns 401 { error: 'Unauthorized' } otherwise.
 */
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const expected = Buffer.from(
    `${process.env.AUTH_USERNAME}:${process.env.AUTH_PASSWORD}`
  ).toString('base64');

  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = requireAuth;
