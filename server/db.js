'use strict';

const mongoose = require('mongoose');

/**
 * Connect to MongoDB using MONGODB_URI env var.
 * Caches the connection at module level so warm Vercel invocations reuse it.
 * readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
async function connect() {
  const state = mongoose.connection.readyState;

  if (state === 1) {
    // Already connected — reuse existing connection
    return;
  }

  if (state === 2) {
    // Connection in progress — wait for it to open
    await new Promise((resolve, reject) => {
      mongoose.connection.once('open', resolve);
      mongoose.connection.once('error', reject);
    });
    return;
  }

  // state === 0 (disconnected) or 3 (disconnecting) — open a new connection
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    throw err; // propagate so caller can return 503
  }
}

module.exports = { connect };
