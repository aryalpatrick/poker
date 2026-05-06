'use strict';

/**
 * Unit tests for round validation logic.
 * These tests mock the DB models — no real MongoDB connection required.
 * Requirements: 4.8, 8.3
 */

// Set env vars BEFORE requiring the app
beforeAll(() => {
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password';
  process.env.MONGODB_URI = 'mongodb://localhost/test';
});

// Mock mongoose connect so db.js doesn't try to connect to a real DB
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

// A valid ObjectId for use in tests
const GAME_ID = new mongoose.Types.ObjectId().toString();

describe('Round validation — winner not in player list', () => {
  test('returns 400 when winnerName is not in game.players', async () => {
    const game = {
      _id: GAME_ID,
      name: 'Test Game',
      players: ['Alice', 'Bob'],
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 2,
      status: 'active'
    };

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    // Mock Round.findOne for roundNumber computation
    Round.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })
    });

    const res = await request(app)
      .post(`/api/games/${GAME_ID}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 2, red: 1, green: 0, blue: 0 },
        winnerName: 'Charlie' // not in players
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Winner must be a game player');
  });

  test('returns 201 when winnerName is in game.players', async () => {
    const gameId = new mongoose.Types.ObjectId();
    const game = {
      _id: gameId,
      name: 'Test Game',
      players: ['Alice', 'Bob'],
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 2,
      status: 'active'
    };

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })
    });

    const savedRound = {
      _id: new mongoose.Types.ObjectId(),
      gameId: gameId,
      roundNumber: 1,
      chips: { white: 2, red: 1, green: 0, blue: 0 },
      potNPR: 35,
      winnerName: 'Alice',
      rakeNPR: 0.7,
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
        chips: { white: 2, red: 1, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(201);
  });
});

describe('Round validation — closed game rejection', () => {
  test('returns 409 when game status is closed', async () => {
    const game = {
      _id: GAME_ID,
      name: 'Closed Game',
      players: ['Alice', 'Bob'],
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 2,
      status: 'closed'
    };

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    const res = await request(app)
      .post(`/api/games/${GAME_ID}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 2, red: 1, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Game is closed');
  });

  test('returns 409 regardless of payload when game is closed', async () => {
    const game = {
      _id: GAME_ID,
      name: 'Closed Game',
      players: ['Alice', 'Bob'],
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 5,
      status: 'closed'
    };

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    // Even with a valid winner, closed game should reject
    const res = await request(app)
      .post(`/api/games/${GAME_ID}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 10, red: 5, green: 2, blue: 1 },
        winnerName: 'Bob'
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Game is closed');
  });

  test('returns 201 when game is active', async () => {
    const gameId = new mongoose.Types.ObjectId();
    const game = {
      _id: gameId,
      name: 'Active Game',
      players: ['Alice', 'Bob'],
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 2,
      status: 'active'
    };

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })
    });

    const savedRound = {
      _id: new mongoose.Types.ObjectId(),
      gameId: gameId,
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
});
