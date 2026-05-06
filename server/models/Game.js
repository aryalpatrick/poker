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
    required: true
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
