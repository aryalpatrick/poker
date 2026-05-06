'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const Round = require('../models/Round');

const router = express.Router();

const VALID_RAKE_PERCENTS = [1, 2, 2.5, 3, 5];

/**
 * Validate game creation/update fields.
 * Returns an array of error strings; empty array means valid.
 */
function validateGameFields({ name, players, rakePercent }) {
  const errors = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.push('Game name must be a non-empty string');
    }
  }

  if (players !== undefined) {
    if (!Array.isArray(players) || players.length < 2) {
      errors.push('At least 2 players required');
    } else {
      players.forEach((p, i) => {
        if (typeof p !== 'string' || p.trim().length === 0) {
          errors.push(`Player at index ${i} must be a non-empty, non-whitespace string`);
        }
      });
    }
  }

  if (rakePercent !== undefined) {
    if (!VALID_RAKE_PERCENTS.includes(rakePercent)) {
      errors.push(`rakePercent must be one of: ${VALID_RAKE_PERCENTS.join(', ')}`);
    }
  }

  return errors;
}

/**
 * GET /api/games
 * List all games sorted by createdAt descending, with computed totalRake.
 * Requirements: 3.1, 3.2, 3.3
 */
router.get('/', async (req, res, next) => {
  try {
    const games = await Game.find().sort({ createdAt: -1 }).lean();

    if (games.length === 0) {
      return res.json([]);
    }

    const gameIds = games.map((g) => g._id);

    // Aggregate total rake per game from rounds collection
    const rakeAgg = await Round.aggregate([
      { $match: { gameId: { $in: gameIds } } },
      { $group: { _id: '$gameId', totalRake: { $sum: '$rakeNPR' } } }
    ]);

    const rakeMap = {};
    rakeAgg.forEach((r) => {
      rakeMap[r._id.toString()] = r.totalRake;
    });

    const result = games.map((g) => ({
      ...g,
      totalRake: rakeMap[g._id.toString()] || 0
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games
 * Create a new game.
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, players, chipValues, rakePercent } = req.body;

    // Validate required fields presence
    const missingErrors = [];
    if (name === undefined || name === null) missingErrors.push('name is required');
    if (players === undefined || players === null) missingErrors.push('players is required');
    if (rakePercent === undefined || rakePercent === null) missingErrors.push('rakePercent is required');

    if (missingErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: missingErrors });
    }

    const errors = validateGameFields({ name, players, rakePercent });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const gameData = {
      name: name.trim(),
      players: players.map((p) => p.trim()),
      rakePercent
    };

    if (chipValues) {
      gameData.chipValues = chipValues;
    }

    const game = new Game(gameData);
    await game.save();

    res.status(201).json(game.toObject());
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:id
 * Get a single game by ID.
 * Requirements: 7.1
 */
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const game = await Game.findById(req.params.id).lean();
    if (!game) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(game);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/games/:id
 * Update rakePercent or status on a game.
 * Requirements: 7.2, 8.1
 */
router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { rakePercent, status } = req.body;
    const updates = {};

    if (rakePercent !== undefined) {
      if (!VALID_RAKE_PERCENTS.includes(rakePercent)) {
        return res.status(400).json({
          error: 'Validation failed',
          details: [`rakePercent must be one of: ${VALID_RAKE_PERCENTS.join(', ')}`]
        });
      }
      updates.rakePercent = rakePercent;
    }

    if (status !== undefined) {
      if (!['active', 'closed'].includes(status)) {
        return res.status(400).json({
          error: 'Validation failed',
          details: ['status must be one of: active, closed']
        });
      }
      updates.status = status;
    }

    // registry: { PlayerName: { buyIn: number, lent: number, chips?: {...} } }
    if (req.body.registry !== undefined) {
      const registry = req.body.registry;
      if (typeof registry !== 'object' || Array.isArray(registry)) {
        return res.status(400).json({ error: 'Validation failed', details: ['registry must be an object'] });
      }
      for (const [player, entry] of Object.entries(registry)) {
        if (entry.buyIn !== undefined && typeof entry.buyIn !== 'number') {
          return res.status(400).json({ error: 'Validation failed', details: [`registry.${player}: buyIn must be a number`] });
        }
        if (entry.lent !== undefined && typeof entry.lent !== 'number') {
          return res.status(400).json({ error: 'Validation failed', details: [`registry.${player}: lent must be a number`] });
        }
        const update = {};
        if (entry.buyIn !== undefined) update.buyIn = entry.buyIn;
        if (entry.lent  !== undefined) update.lent  = entry.lent;
        if (entry.chips !== undefined) update.chips = entry.chips;
        updates[`registry.${player}`] = { buyIn: entry.buyIn || 0, lent: entry.lent || 0, ...update };
      }
    }

    const game = await Game.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!game) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(game);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.validateGameFields = validateGameFields;
module.exports.VALID_RAKE_PERCENTS = VALID_RAKE_PERCENTS;
