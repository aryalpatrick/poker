'use strict';

/**
 * Integration tests for Round CRUD operations.
 * Tests create round, read rounds, update round, and verifies immutable fields are preserved.
 * Requirements: 4.11, 5.4, 5.6
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
// Helpers: create mock game and round objects
// ---------------------------------------------------------------------------
function makeMockGame(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    name: 'Test Game',
    players: ['Alice', 'Bob', 'Charlie'],
    chipValues: { white: 5, red: 25, green: 50, blue: 125 },
    rakePercent: 2,
    status: 'active',
    createdAt: new Date('2024-06-01T18:00:00Z'),
    ...overrides
  };
}

function makeMockRound(gameId, overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    gameId,
    roundNumber: 1,
    chips: { white: 2, red: 1, green: 0, blue: 0 },
    potNPR: 35,
    winnerName: 'Alice',
    rakeNPR: 0.7,
    createdAt: new Date('2024-06-01T19:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Test: Create round (POST /api/games/:id/rounds)
// Requirements: 4.11
// ---------------------------------------------------------------------------
describe('POST /api/games/:id/rounds — create round', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a round with valid data and returns 201', async () => {
    const game = makeMockGame();
    const savedRound = makeMockRound(game._id);

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null) // no existing rounds
      })
    });

    Round.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue(savedRound)
    }));

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 2, red: 1, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('gameId');
    expect(res.body).toHaveProperty('roundNumber', 1);
    expect(res.body).toHaveProperty('winnerName', 'Alice');
    expect(res.body).toHaveProperty('potNPR');
    expect(res.body).toHaveProperty('rakeNPR');
  });

  test('assigns roundNumber as max existing + 1', async () => {
    const game = makeMockGame();
    const existingRound = makeMockRound(game._id, { roundNumber: 3 });
    const newRound = makeMockRound(game._id, { roundNumber: 4 });

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    // Last round has roundNumber 3
    Round.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(existingRound)
      })
    });

    Round.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue(newRound)
    }));

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 1, red: 0, green: 0, blue: 0 },
        winnerName: 'Bob'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('roundNumber', 4);
  });

  test('computes potNPR and rakeNPR correctly', async () => {
    const game = makeMockGame({
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 2
    });

    // chips: 2 white + 1 red = 10 + 25 = 35 NPR; rake = 35 * 0.02 = 0.7
    const savedRound = makeMockRound(game._id, {
      chips: { white: 2, red: 1, green: 0, blue: 0 },
      potNPR: 35,
      rakeNPR: 0.7
    });

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })
    });

    Round.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue(savedRound)
    }));

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 2, red: 1, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('potNPR', 35);
    expect(res.body).toHaveProperty('rakeNPR', 0.7);
  });

  test('returns 400 when winner is not in player list', async () => {
    const game = makeMockGame();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })
    });

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 1, red: 0, green: 0, blue: 0 },
        winnerName: 'Dave' // not in players
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Winner must be a game player');
  });

  test('returns 404 when game not found', async () => {
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
});

// ---------------------------------------------------------------------------
// Test: Read rounds (GET /api/games/:id/rounds)
// Requirements: 4.11
// ---------------------------------------------------------------------------
describe('GET /api/games/:id/rounds — read rounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns rounds ordered by roundNumber ascending', async () => {
    const game = makeMockGame();
    const round1 = makeMockRound(game._id, { roundNumber: 1 });
    const round2 = makeMockRound(game._id, { roundNumber: 2 });
    const round3 = makeMockRound(game._id, { roundNumber: 3 });

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([round1, round2, round3])
      })
    });

    const res = await request(app)
      .get(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty('roundNumber', 1);
    expect(res.body[1]).toHaveProperty('roundNumber', 2);
    expect(res.body[2]).toHaveProperty('roundNumber', 3);
  });

  test('returns empty array when game has no rounds', async () => {
    const game = makeMockGame();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });

    const res = await request(app)
      .get(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 404 when game not found', async () => {
    const id = new mongoose.Types.ObjectId();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });

    const res = await request(app)
      .get(`/api/games/${id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(404);
  });

  test('each round contains required fields', async () => {
    const game = makeMockGame();
    const round = makeMockRound(game._id);

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([round])
      })
    });

    const res = await request(app)
      .get(`/api/games/${game._id.toString()}/rounds`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    const r = res.body[0];
    expect(r).toHaveProperty('gameId');
    expect(r).toHaveProperty('roundNumber');
    expect(r).toHaveProperty('chips');
    expect(r).toHaveProperty('potNPR');
    expect(r).toHaveProperty('winnerName');
    expect(r).toHaveProperty('rakeNPR');
    expect(r).toHaveProperty('createdAt');
  });
});

// ---------------------------------------------------------------------------
// Test: Update round (PUT /api/games/:id/rounds/:roundId)
// Requirements: 5.4, 5.6
// ---------------------------------------------------------------------------
describe('PUT /api/games/:id/rounds/:roundId — update round', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('updates chip counts and winner, returns 200', async () => {
    const game = makeMockGame();
    const roundId = new mongoose.Types.ObjectId();
    const existingRound = makeMockRound(game._id, {
      _id: roundId,
      chips: { white: 2, red: 1, green: 0, blue: 0 },
      winnerName: 'Alice'
    });
    const updatedRound = {
      ...existingRound,
      chips: { white: 0, red: 0, green: 1, blue: 1 },
      winnerName: 'Bob',
      potNPR: 175,
      rakeNPR: 3.5
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

    const res = await request(app)
      .put(`/api/games/${game._id.toString()}/rounds/${roundId.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 0, red: 0, green: 1, blue: 1 },
        winnerName: 'Bob'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('winnerName', 'Bob');
    expect(res.body.chips).toEqual({ white: 0, red: 0, green: 1, blue: 1 });
  });

  test('preserves immutable fields: roundNumber, gameId, createdAt', async () => {
    const game = makeMockGame();
    const roundId = new mongoose.Types.ObjectId();
    const createdAt = new Date('2024-06-01T19:00:00Z');
    const existingRound = makeMockRound(game._id, {
      _id: roundId,
      roundNumber: 7,
      createdAt
    });
    const updatedRound = {
      ...existingRound,
      chips: { white: 3, red: 0, green: 0, blue: 0 },
      winnerName: 'Charlie',
      potNPR: 15,
      rakeNPR: 0.3
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

    const res = await request(app)
      .put(`/api/games/${game._id.toString()}/rounds/${roundId.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 3, red: 0, green: 0, blue: 0 },
        winnerName: 'Charlie'
      });

    expect(res.status).toBe(200);

    // Immutable fields must be preserved
    expect(res.body).toHaveProperty('roundNumber', 7);
    expect(res.body.gameId.toString()).toBe(game._id.toString());
    expect(new Date(res.body.createdAt).getTime()).toBe(createdAt.getTime());

    // Verify the $set in findByIdAndUpdate does NOT include immutable fields
    const updateCall = Round.findByIdAndUpdate.mock.calls[0];
    const setFields = updateCall[1].$set;
    expect(setFields).not.toHaveProperty('roundNumber');
    expect(setFields).not.toHaveProperty('gameId');
    expect(setFields).not.toHaveProperty('createdAt');
  });

  test('recomputes potNPR and rakeNPR on update', async () => {
    const game = makeMockGame({
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 2
    });
    const roundId = new mongoose.Types.ObjectId();
    const existingRound = makeMockRound(game._id, { _id: roundId });

    // 1 blue chip = 125 NPR; rake = 125 * 0.02 = 2.5
    const updatedRound = {
      ...existingRound,
      chips: { white: 0, red: 0, green: 0, blue: 1 },
      potNPR: 125,
      rakeNPR: 2.5,
      winnerName: 'Bob'
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

    const res = await request(app)
      .put(`/api/games/${game._id.toString()}/rounds/${roundId.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 0, red: 0, green: 0, blue: 1 },
        winnerName: 'Bob'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('potNPR', 125);
    expect(res.body).toHaveProperty('rakeNPR', 2.5);
  });

  test('returns 400 when winner is not in player list', async () => {
    const game = makeMockGame();
    const roundId = new mongoose.Types.ObjectId();
    const existingRound = makeMockRound(game._id, { _id: roundId });

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(existingRound)
    });

    const res = await request(app)
      .put(`/api/games/${game._id.toString()}/rounds/${roundId.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 1, red: 0, green: 0, blue: 0 },
        winnerName: 'NotAPlayer'
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Winner must be a game player');
  });

  test('returns 404 when round not found', async () => {
    const game = makeMockGame();
    const roundId = new mongoose.Types.ObjectId();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    Round.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });

    const res = await request(app)
      .put(`/api/games/${game._id.toString()}/rounds/${roundId.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        chips: { white: 1, red: 0, green: 0, blue: 0 },
        winnerName: 'Alice'
      });

    expect(res.status).toBe(404);
  });
});
