'use strict';

const express = require('express');

const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Compares req.body.username and req.body.password against AUTH_USERNAME / AUTH_PASSWORD env vars.
 * On match: sets a simple auth_token cookie (base64 of username:password) and returns 200 { ok: true }.
 * On mismatch: returns 401 { error: 'Invalid credentials' }.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== validUsername ||
    password !== validPassword
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const cookieValue = Buffer.from(`${username}:${password}`).toString('base64');

  res.cookie('auth_token', cookieValue, {
    secure: true,
    sameSite: 'strict',
  });

  return res.status(200).json({ ok: true });
});

/**
 * POST /api/auth/logout
 *
 * Clears the auth_token cookie and returns 200 { ok: true }.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', {
    secure: true,
    sameSite: 'strict',
  });

  return res.status(200).json({ ok: true });
});

module.exports = router;
