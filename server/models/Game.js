'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const gameSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  players: {
    type: [String],
    required: true,
    validate: {
      validator: (v) => Array.isArray(v) && v.length >= 2,
      message: 'At least 2 players required'
    }
  },
  chipValues: {
    white: { type: Number, default: 5 },
    red:   { type: Number, default: 25 },
    green: { type: Number, default: 50 },
    blue:  { type: Number, default: 125 }
  },
  rakePercent: {
    type: Number,
    enum: [1, 2, 2.5, 3, 5],
    default: 3,
    required: true
  },
  // registry: per-player buy-in, lending, and cashout chips
  // { "PlayerName": { buyIn: 500, lent: 200, chips: { white: 2, red: 1, green: 0, blue: 0 } } }
  registry: {
    type: Map,
    of: new mongoose.Schema({
      buyIn: { type: Number, default: 0 },
      lent:  { type: Number, default: 0 },
      chips: {
        white: { type: Number, default: 0 },
        red:   { type: Number, default: 0 },
        green: { type: Number, default: 0 },
        blue:  { type: Number, default: 0 },
      }
    }, { _id: false }),
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Game', gameSchema);
