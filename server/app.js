'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const authRouter = require('./routes/auth');
const requireAuth = require('./middleware/requireAuth');
const gamesRouter = require('./routes/games');
const roundsRouter = require('./routes/rounds');

const app = express();

// Serve static files from public/ (for local dev — Vercel handles this via rewrites)
app.use(express.static(path.join(__dirname, '../public')));

// Body parsing middleware
app.use(express.json());
app.use(cookieParser());

// Lazy DB connection — connects on first request, reuses on warm invocations.
// Skipped for auth routes which don't touch the DB.
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/auth')) return next();
  try {
    await db.connect();
    next();
  } catch (err) {
    next(err);
  }
});

// Auth routes (no auth guard)
app.use('/api/auth', authRouter);

// Games routes (protected)
app.use('/api/games', requireAuth, gamesRouter);

// Rounds routes (protected) — mounted at /api/games so mergeParams gives access to :id
app.use('/api/games', requireAuth, roundsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// SPA fallback — serve index.html for any non-API route (local dev)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
// Handles Mongoose errors, explicit status codes, and DB connection failures.
app.use((err, req, res, next) => {
  // Mongoose validation error → 400
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Mongoose CastError (invalid ObjectId) → 404
  if (err.name === 'CastError') {
    return res.status(404).json({ error: 'Resource not found' });
  }

  // DB connection failure → 503
  if (
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoServerSelectionError' ||
    err.message === 'DB connection unavailable'
  ) {
    return res.status(503).json({ error: 'Database connection unavailable' });
  }

  // Use explicit status if set (e.g. from route handlers)
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

module.exports = app;
