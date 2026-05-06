'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const Round = require('../models/Round');
const { computePot, computeRake } = require('../../lib/calc');

// mergeParams: true so we can access :id from the parent /api/games router
const router = express.Router({ mergeParams: true });

/**
 * GET /api/games/:id/rounds
 * List all rounds for a game ordered by roundNumber ascending.
 * Requirements: 6.3, 6.4
 */
router.get('/:id/rounds', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const game = await Game.findById(req.params.id).lean();
    if (!game) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rounds = await Round.find({ gameId: req.params.id })
      .sort({ roundNumber: 1 })
      .lean();

    res.json(rounds);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games/:id/rounds
 * Create a new round for a game.
 * Requirements: 4.8, 4.9, 4.10, 4.11, 8.3
 */
router.post('/:id/rounds', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const game = await Game.findById(req.params.id).lean();
    if (!game) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Reject round creation on closed games
    if (game.status === 'closed') {
      return res.status(409).json({ error: 'Game is closed' });
    }

    const { chips, winnerName } = req.body;

    // Validate winnerName is in game.players
    if (!game.players.includes(winnerName)) {
      return res.status(400).json({ error: 'Winner must be a game player' });
    }

    // Compute roundNumber as max existing + 1 (or 1 if no rounds)
    const lastRound = await Round.findOne({ gameId: req.params.id })
      .sort({ roundNumber: -1 })
      .lean();
    const roundNumber = lastRound ? lastRound.roundNumber + 1 : 1;

    // Compute pot and rake
    const normalizedChips = {
      white: (chips && chips.white) || 0,
      red:   (chips && chips.red)   || 0,
      green: (chips && chips.green) || 0,
      blue:  (chips && chips.blue)  || 0
    };

    const potNPR = computePot(normalizedChips, game.chipValues);
    const rakeNPR = computeRake(potNPR, game.rakePercent);

    const round = new Round({
      gameId: game._id,
      roundNumber,
      chips: normalizedChips,
      potNPR,
      winnerName,
      rakeNPR
    });

    await round.save();

    res.status(201).json(round.toObject());
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/games/:id/rounds/:roundId
 * Update an existing round (chip counts and/or winner).
 * Preserves roundNumber, gameId, createdAt.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
router.put('/:id/rounds/:roundId', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.roundId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const game = await Game.findById(req.params.id).lean();
    if (!game) {
      return res.status(404).json({ error: 'Not found' });
    }

    const existingRound = await Round.findById(req.params.roundId).lean();
    if (!existingRound) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { chips, winnerName } = req.body;

    // Validate winnerName is in game.players
    if (!game.players.includes(winnerName)) {
      return res.status(400).json({ error: 'Winner must be a game player' });
    }

    // Recompute pot and rake with updated chips
    const normalizedChips = {
      white: (chips && chips.white) || 0,
      red:   (chips && chips.red)   || 0,
      green: (chips && chips.green) || 0,
      blue:  (chips && chips.blue)  || 0
    };

    const potNPR = computePot(normalizedChips, game.chipValues);
    const rakeNPR = computeRake(potNPR, game.rakePercent);

    // Update only mutable fields; preserve roundNumber, gameId, createdAt
    const updated = await Round.findByIdAndUpdate(
      req.params.roundId,
      {
        $set: {
          chips: normalizedChips,
          winnerName,
          potNPR,
          rakeNPR
        }
      },
      { new: true, runValidators: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
