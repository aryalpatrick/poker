'use strict';

/**
 * Integration tests for closed game guard.
 * Tests: POST round to closed game returns 409.
 * Requirements: 8.3
 */

// ---------------------------------------------------------------------------
// Set env vars BEFORE requiring the app
// ---------------------------------------------------------------------------
beforeAll(() => {
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password';
  process.env.MONGODB_URI = 'mongodb://localhost/test';
});

// ---------------------------------------------------------------------------
// Mock DB connection and models
// ---------------------------------------------------------------------------
jest.mock('../db', () => ({
  connect: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../models/Game');
jest.mock('../models/Round');

const request = require('supertest');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const Round = require('../models/Round');
const app = require('../app');

// ---------------------------------------------------------------------------
// Helper: build a valid auth_token cookie
// ---------------------------------------------------------------------------
function makeAuthCookie() {
  const value = Buffer.from('admin:password').toString('base64');
  return `auth_token=${value}`;
}

const AUTH_COOKIE = makeAuthCookie();

// ---------------------------------------------------------------------------
// Helper: create a closed game mock
// ---------------------------------------------------------------------------
function makeClosedGame(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    name: 'Closed Game',
    players: ['Alice', 'Bob'],
    chipValues: { white: 5, red: 25, green: 50, blue: 125 },
    rakePercent: 2,
    status: 'closed',
    createdAt: new Date('2024-06-01T18:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Test: POST round to closed game returns 409
// Requirements: 8.3
// ---------------------------------------------------------------------------
describe('POST /api/games/:id/rounds — closed game guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 409 when game status is closed', async () => {
    const game = makeClosedGame();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 2, red: 1, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Game is closed');
  });

  test('returns 409 regardless of chip payload when game is closed', async () => {
    const game = makeClosedGame();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    // Try with all-zero chips
    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 0, red: 0, green: 0, blue: 0 },
        winnerName: 'Bob'
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Game is closed');
  });

  test('returns 409 regardless of winner when game is closed', async () => {
    const game = makeClosedGame({ players: ['Alice', 'Bob', 'Charlie'] });

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    // Try with each player as winner — all should return 409
    for (const winner of game.players) {
      jest.clearAllMocks();
      Game.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(game)
      });

      const res = await request(app)
        .post(`/api/games/${game._id.toString()}/rounds`)
        .set('Cookie', AUTH_COOKIE)
        .send({
          chips: { white: 1, red: 0, green: 0, blue: 0 },
          winnerName: winner
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error', 'Game is closed');
    }
  });

  test('returns 409 even with a winner not in player list (closed check fires first)', async () => {
    const game = makeClosedGame();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 1, red: 0, green: 0, blue: 0 },
        winnerName: 'NotAPlayer'
      });

    // Closed game check fires before winner validation
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Game is closed');
  });

  test('returns 201 when game is active (not closed)', async () => {
    const gameId = new mongoose.Types.ObjectId();
    const activeGame = {
      _id: gameId,
      name: 'Active Game',
      players: ['Alice', 'Bob'],
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 2,
      status: 'active',
      createdAt: new Date()
    };

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(activeGame)
    });

    Round.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })
    });

    const savedRound = {
      _id: new mongoose.Types.ObjectId(),
      gameId,
      roundNumber: 1,
      chips: { white: 2, red: 0, green: 0, blue: 0 },
      potNPR: 10,
      winnerName: 'Alice',
      rakeNPR: 0.2,
      createdAt: new Date()
    };

    Round.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue(savedRound)
    }));

    const res = await request(app)
      .post(`/api/games/${gameId.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 2, red: 0, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(201);
  });

  test('returns 404 when game does not exist', async () => {
    const id = new mongoose.Types.ObjectId();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });

    const res = await request(app)
      .post(`/api/games/${id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 1, red: 0, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(404);
  });

  test('returns 401 without auth cookie', async () => {
    const game = makeClosedGame();

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/rounds`)
      .send({
        chips: { white: 1, red: 0, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(401);
  });
});
