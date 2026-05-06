'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const roundSchema = new Schema({
  gameId: {
    type: Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  roundNumber: {
    type: Number,
    required: true
  },
  chips: {
    white: { type: Number, default: 0 },
    red:   { type: Number, default: 0 },
    green: { type: Number, default: 0 },
    blue:  { type: Number, default: 0 }
  },
  potNPR: {
    type: Number,
    required: true
  },
  winnerName: {
    type: String,
    required: true
  },
  rakeNPR: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Round', roundSchema);
