'use strict';

/**
 * Property-based tests for the Rounds API router.
 * Uses fast-check to verify universal properties.
 * DB models are mocked — no real MongoDB connection required.
 */

const fc = require('fast-check');
const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Set env vars BEFORE requiring the app so requireAuth and db.js work
// ---------------------------------------------------------------------------
beforeAll(() => {
  process.env.COOKIE_SECRET = 'test-secret';
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password';
  process.env.MONGODB_URI = 'mongodb://localhost/test';
});

// ---------------------------------------------------------------------------
// Mock mongoose connect so db.js doesn't try to connect to a real DB
// ---------------------------------------------------------------------------
jest.mock('../db', () => ({
  connect: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../models/Game');
jest.mock('../models/Round');

const Game = require('../models/Game');
const Round = require('../models/Round');
const app = require('../app');

// ---------------------------------------------------------------------------
// Helper: build a valid auth_token cookie
// ---------------------------------------------------------------------------
function makeAuthCookie(secret = 'test-secret') {
  const payload = 'admin';
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `auth_token=${payload}.${sig}`;
}

const AUTH_COOKIE = makeAuthCookie();

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// A valid player name (non-empty, non-whitespace)
const playerNameArb = fc
  .string({ minLength: 1, maxLength: 15 })
  .filter((s) => s.trim().length > 0);

// A valid chip counts object
const chipsArb = fc.record({
  white: fc.integer({ min: 0, max: 50 }),
  red:   fc.integer({ min: 0, max: 50 }),
  green: fc.integer({ min: 0, max: 50 }),
  blue:  fc.integer({ min: 0, max: 50 })
});

// A valid rake percent
const rakePercentArb = fc.constantFrom(1, 2, 2.5, 3, 5);

// A valid chip values object
const chipValuesArb = fc.record({
  white: fc.integer({ min: 1, max: 1000 }),
  red:   fc.integer({ min: 1, max: 1000 }),
  green: fc.integer({ min: 1, max: 1000 }),
  blue:  fc.integer({ min: 1, max: 1000 })
});

// ---------------------------------------------------------------------------
// Property 8: Closed games reject new round creation
// Feature: poker-app, Property 8: Closed games reject new round creation
// Validates: Requirements 8.3
// ---------------------------------------------------------------------------

describe('Property 8: Closed games reject new round creation', () => {
  test('POST /api/games/:id/rounds returns 409 for any payload when game is closed', async () => {
    // Feature: poker-app, Property 8: Closed games reject new round creation
    await fc.assert(
      fc.asyncProperty(
        chipsArb,
        fc.array(playerNameArb, { minLength: 2, maxLength: 5 }),
        rakePercentArb,
        chipValuesArb,
        async (chips, players, rakePercent, chipValues) => {
          const gameId = new mongoose.Types.ObjectId();
          const closedGame = {
            _id: gameId,
            name: 'Closed Game',
            players,
            chipValues,
            rakePercent,
            status: 'closed'
          };

          Game.findById = jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(closedGame)
          });

          // Use any player as winner (or a random string — closed game check fires first)
          const winnerName = players[0];

          const res = await request(app)
            .post(`/api/games/${gameId.toString()}/rounds`)
            .set('Cookie', AUTH_COOKIE)
            .send({ chips, winnerName });

          expect(res.status).toBe(409);
          expect(res.body).toHaveProperty('error', 'Game is closed');
        }
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Editing a round preserves immutable fields
// Feature: poker-app, Property 6: Editing a round preserves immutable fields
// Validates: Requirements 5.6
// ---------------------------------------------------------------------------

describe('Property 6: Editing a round preserves immutable fields', () => {
  test('PUT /api/games/:id/rounds/:roundId does not change roundNumber, gameId, or createdAt', async () => {
    // Feature: poker-app, Property 6: Editing a round preserves immutable fields
    await fc.assert(
      fc.asyncProperty(
        chipsArb,           // original chips
        chipsArb,           // updated chips
        fc.array(playerNameArb, { minLength: 2, maxLength: 5 }),
        rakePercentArb,
        chipValuesArb,
        fc.integer({ min: 1, max: 100 }), // roundNumber
        async (originalChips, updatedChips, players, rakePercent, chipValues, roundNumber) => {
          const gameId = new mongoose.Types.ObjectId();
          const roundId = new mongoose.Types.ObjectId();
          const createdAt = new Date('2024-01-15T10:00:00Z');

          const game = {
            _id: gameId,
            name: 'Test Game',
            players,
            chipValues,
            rakePercent,
            status: 'active'
          };

          const existingRound = {
            _id: roundId,
            gameId: gameId,
            roundNumber,
            chips: originalChips,
            potNPR: 100,
            winnerName: players[0],
            rakeNPR: 2,
            createdAt
          };

          // The updated round returned by findByIdAndUpdate preserves immutable fields
          const updatedRound = {
            _id: roundId,
            gameId: gameId,           // preserved
            roundNumber,              // preserved
            chips: updatedChips,
            potNPR: 200,              // recomputed
            winnerName: players[1 % players.length],
            rakeNPR: 4,               // recomputed
            createdAt                 // preserved
          };

          Game.findById = jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(game)
          });

          Round.findById = jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(existingRound)
          });

          Round.findByIdAndUpdate = jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(updatedRound)
          });

          const winnerName = players[1 % players.length];

          const res = await request(app)
            .put(`/api/games/${gameId.toString()}/rounds/${roundId.toString()}`)
            .set('Cookie', AUTH_COOKIE)
            .send({ chips: updatedChips, winnerName });

          expect(res.status).toBe(200);

          // Verify immutable fields are preserved in the response
          expect(res.body.roundNumber).toBe(roundNumber);
          expect(res.body.gameId.toString()).toBe(gameId.toString());
          expect(new Date(res.body.createdAt).getTime()).toBe(createdAt.getTime());

          // Verify findByIdAndUpdate was NOT called with roundNumber, gameId, or createdAt in $set
          const updateCall = Round.findByIdAndUpdate.mock.calls[0];
          const setFields = updateCall[1].$set;
          expect(setFields).not.toHaveProperty('roundNumber');
          expect(setFields).not.toHaveProperty('gameId');
          expect(setFields).not.toHaveProperty('createdAt');
        }
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Rake percent change does not affect existing rounds
// Feature: poker-app, Property 11: Rake percent change does not affect existing rounds
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------

describe('Property 11: Rake percent change does not affect existing rounds', () => {
  // This test makes 2 HTTP requests per iteration × 100 iterations, so needs extra time
  test('PATCH rakePercent does not modify rakeNPR or potNPR of existing rounds', async () => {
    // Feature: poker-app, Property 11: Rake percent change does not affect existing rounds
    await fc.assert(
      fc.asyncProperty(
        fc.array(playerNameArb, { minLength: 2, maxLength: 5 }),
        rakePercentArb,
        rakePercentArb,
        fc.array(
          fc.record({
            chips: chipsArb,
            winnerName: playerNameArb,
            potNPR: fc.integer({ min: 0, max: 100000 }),
            rakeNPR: fc.float({ min: 0, max: 5000, noNaN: true })
          }),
          { minLength: 1, maxLength: 5 }
        ),

        async (players, originalRakePercent, newRakePercent, roundData) => {
          // Reset all mocks at the start of each property iteration
          jest.clearAllMocks();

          const gameId = new mongoose.Types.ObjectId();

          const game = {
            _id: gameId,
            name: 'Test Game',
            players,
            chipValues: { white: 5, red: 25, green: 50, blue: 125 },
            rakePercent: originalRakePercent,
            status: 'active'
          };

          // Build existing rounds with their original rakeNPR values
          const existingRounds = roundData.map((rd, i) => ({
            _id: new mongoose.Types.ObjectId(),
            gameId: gameId,
            roundNumber: i + 1,
            chips: rd.chips,
            potNPR: rd.potNPR,
            winnerName: players[i % players.length],
            rakeNPR: rd.rakeNPR,
            createdAt: new Date()
          }));

          // Mock GET game
          Game.findById = jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(game)
          });

          // Mock PATCH game — returns updated game with new rakePercent
          const updatedGame = { ...game, rakePercent: newRakePercent };
          Game.findByIdAndUpdate = jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(updatedGame)
          });

          // Mock GET rounds — returns the same rounds regardless of rakePercent change
          Round.find = jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(existingRounds)
            })
          });

          // Ensure Round.findByIdAndUpdate starts uncalled
          Round.findByIdAndUpdate = jest.fn();

          // Step 1: PATCH the game's rakePercent
          const patchRes = await request(app)
            .patch(`/api/games/${gameId.toString()}`)
            .set('Cookie', AUTH_COOKIE)
            .send({ rakePercent: newRakePercent });

          expect(patchRes.status).toBe(200);

          // Step 2: GET the rounds after the rakePercent change
          const roundsRes = await request(app)
            .get(`/api/games/${gameId.toString()}/rounds`)
            .set('Cookie', AUTH_COOKIE);

          expect(roundsRes.status).toBe(200);
          expect(Array.isArray(roundsRes.body)).toBe(true);
          expect(roundsRes.body).toHaveLength(existingRounds.length);

          // Step 3: Verify each round's rakeNPR and potNPR are unchanged
          roundsRes.body.forEach((returnedRound, i) => {
            expect(returnedRound.rakeNPR).toBe(existingRounds[i].rakeNPR);
            expect(returnedRound.potNPR).toBe(existingRounds[i].potNPR);
          });

          // Step 4: Verify Round.findByIdAndUpdate was NOT called
          // (rounds should not be modified when rakePercent changes)
          expect(Round.findByIdAndUpdate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 25 }
    );
  }, 30000); // 30 second timeout: 25 iterations × 2 HTTP requests each
});
