'use strict';

const express = require('express');
const { hmac } = require('../middleware/requireAuth');

const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Compares req.body.username and req.body.password against AUTH_USERNAME / AUTH_PASSWORD env vars.
 * On match: creates a signed auth_token cookie (payload = username, sig = HMAC-SHA256(username, COOKIE_SECRET))
 * and returns 200 { ok: true }.
 * On mismatch: returns 401 { error: 'Invalid credentials' }.
 *
 * Requirements: 1.1, 1.2, 1.3
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;
  const secret = process.env.COOKIE_SECRET;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== validUsername ||
    password !== validPassword
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const payload = username;
  const signature = hmac(payload, secret);
  const cookieValue = `${payload}.${signature}`;

  res.cookie('auth_token', cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });

  return res.status(200).json({ ok: true });
});

/**
 * POST /api/auth/logout
 *
 * Clears the auth_token cookie with the same flags and returns 200 { ok: true }.
 *
 * Requirements: 1.1, 1.2
 */
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });

  return res.status(200).json({ ok: true });
});

module.exports = router;
