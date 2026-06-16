'use strict';

/**
 * Integration tests for Game CRUD operations.
 * Tests the full Express route handler chain using mocked DB models.
 * Requirements: 2.6, 3.2, 3.3, 8.1
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
// Helper: create a mock game object
// ---------------------------------------------------------------------------
function makeMockGame(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    name: 'Friday Night Poker',
    players: ['Alice', 'Bob', 'Charlie'],
    chipValues: { white: 5, red: 25, green: 50, blue: 125 },
    rakePercent: 2,
    status: 'active',
    createdAt: new Date('2024-06-01T18:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Test: Create game (POST /api/games)
// Requirements: 2.6
// ---------------------------------------------------------------------------
describe('POST /api/games — create game', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a game with valid fields and returns 201', async () => {
    const savedGame = makeMockGame();

    Game.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue(savedGame)
    }));

    const res = await request(app)
      .post('/api/games')
      .set('Cookie', AUTH_COOKIE)
      .send({
        name: 'Friday Night Poker',
        players: ['Alice', 'Bob', 'Charlie'],
        rakePercent: 2
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'Friday Night Poker');
    expect(res.body.players).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(res.body).toHaveProperty('rakePercent', 2);
    expect(res.body).toHaveProperty('status', 'active');
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', AUTH_COOKIE)
      .send({
        players: ['Alice', 'Bob'],
        rakePercent: 2
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when fewer than 2 players', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', AUTH_COOKIE)
      .send({
        name: 'Test Game',
        players: ['Alice'],
        rakePercent: 2
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  test('returns 400 when rakePercent is invalid', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', AUTH_COOKIE)
      .send({
        name: 'Test Game',
        players: ['Alice', 'Bob'],
        rakePercent: 4
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  test('returns 401 without auth cookie', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({
        name: 'Test Game',
        players: ['Alice', 'Bob'],
        rakePercent: 2
      });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test: Read game (GET /api/games/:id)
// Requirements: 3.2
// ---------------------------------------------------------------------------
describe('GET /api/games/:id — read single game', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns the game when found', async () => {
    const game = makeMockGame();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(game)
    });

    const res = await request(app)
      .get(`/api/games/${game._id.toString()}`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', game.name);
    expect(res.body).toHaveProperty('status', 'active');
    expect(res.body.players).toEqual(game.players);
  });

  test('returns 404 when game not found', async () => {
    const id = new mongoose.Types.ObjectId();

    Game.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });

    const res = await request(app)
      .get(`/api/games/${id.toString()}`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });

  test('returns 404 for invalid ObjectId', async () => {
    const res = await request(app)
      .get('/api/games/not-a-valid-id')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Test: Update game status (PATCH /api/games/:id)
// Requirements: 8.1
// ---------------------------------------------------------------------------
describe('PATCH /api/games/:id — update game status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('closes an active game (status → closed)', async () => {
    const game = makeMockGame();
    const closedGame = { ...game, status: 'closed' };

    Game.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(closedGame)
    });

    const res = await request(app)
      .patch(`/api/games/${game._id.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ status: 'closed' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'closed');
  });

  test('updates rakePercent on a game', async () => {
    const game = makeMockGame();
    const updatedGame = { ...game, rakePercent: 5 };

    Game.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(updatedGame)
    });

    const res = await request(app)
      .patch(`/api/games/${game._id.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ rakePercent: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rakePercent', 5);
  });

  test('returns 400 for invalid status value', async () => {
    const game = makeMockGame();

    const res = await request(app)
      .patch(`/api/games/${game._id.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ status: 'pending' });

    expect(res.status).toBe(400);
  });

  test('returns 404 when game not found', async () => {
    const id = new mongoose.Types.ObjectId();

    Game.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });

    const res = await request(app)
      .patch(`/api/games/${id.toString()}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ status: 'closed' });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Test: List games with totalRake aggregation (GET /api/games)
// Requirements: 3.2, 3.3
// ---------------------------------------------------------------------------
describe('GET /api/games — list games with totalRake aggregation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns games sorted by createdAt descending with totalRake', async () => {
    const game1 = makeMockGame({
      _id: new mongoose.Types.ObjectId(),
      name: 'Game 1',
      createdAt: new Date('2024-06-02T18:00:00Z')
    });
    const game2 = makeMockGame({
      _id: new mongoose.Types.ObjectId(),
      name: 'Game 2',
      createdAt: new Date('2024-06-01T18:00:00Z')
    });

    // Games already sorted descending by createdAt
    Game.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([game1, game2])
      })
    });

    // Aggregation returns totalRake for game1 only; game2 has no rounds
    Round.aggregate = jest.fn().mockResolvedValue([
      { _id: game1._id, totalRake: 150 }
    ]);

    const res = await request(app)
      .get('/api/games')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    // First game has totalRake from aggregation
    expect(res.body[0]).toHaveProperty('name', 'Game 1');
    expect(res.body[0]).toHaveProperty('totalRake', 150);

    // Second game has no rounds → totalRake defaults to 0
    expect(res.body[1]).toHaveProperty('name', 'Game 2');
    expect(res.body[1]).toHaveProperty('totalRake', 0);
  });

  test('returns empty array when no games exist', async () => {
    Game.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });

    const res = await request(app)
      .get('/api/games')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('totalRake is 0 for a game with no rounds', async () => {
    const game = makeMockGame();

    Game.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([game])
      })
    });

    // No rounds for this game
    Round.aggregate = jest.fn().mockResolvedValue([]);

    const res = await request(app)
      .get('/api/games')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('totalRake', 0);
  });

  test('totalRake sums all round rakeNPR values for a game', async () => {
    const game = makeMockGame();

    Game.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([game])
      })
    });

    // Aggregation returns the summed totalRake
    Round.aggregate = jest.fn().mockResolvedValue([
      { _id: game._id, totalRake: 375.5 }
    ]);

    const res = await request(app)
      .get('/api/games')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('totalRake', 375.5);
  });

  test('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/api/games');

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test: Add player mid-game (POST /api/games/:id/players)
// ---------------------------------------------------------------------------
describe('POST /api/games/:id/players — add player mid-game', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('adds a new player to the game', async () => {
    const game = makeMockGame({ players: ['Alice', 'Bob'] });
    
    // Create a mock save function that returns undefined
    const mockSave = jest.fn().mockResolvedValue(undefined);
    
    // We need Game.findById to return an object with save and players array
    const gameDoc = {
      ...game,
      save: mockSave,
      toObject: jest.fn().mockReturnValue({ ...game, players: ['Alice', 'Bob', 'Charlie'] })
    };

    Game.findById = jest.fn().mockResolvedValue(gameDoc);

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/players`)
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Charlie' });

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(gameDoc.players).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(mockSave).toHaveBeenCalled();
  });

  test('returns 400 if player already exists', async () => {
    const game = makeMockGame({ players: ['Alice', 'Bob'] });
    const gameDoc = {
      ...game,
      save: jest.fn().mockResolvedValue(undefined)
    };

    Game.findById = jest.fn().mockResolvedValue(gameDoc);

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/players`)
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Alice' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  test('returns 400 if name is empty', async () => {
    const game = makeMockGame();

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/players`)
      .set('Cookie', AUTH_COOKIE)
      .send({ name: '  ' });

    expect(res.status).toBe(400);
  });

  test('returns 404 if game not found', async () => {
    const id = new mongoose.Types.ObjectId();
    Game.findById = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/games/${id.toString()}/players`)
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Dave' });

    expect(res.status).toBe(404);
  });

  test('returns 400 if game is closed', async () => {
    const game = makeMockGame({ players: ['Alice', 'Bob'], status: 'closed' });
    const gameDoc = {
      ...game,
      save: jest.fn().mockResolvedValue(undefined)
    };

    Game.findById = jest.fn().mockResolvedValue(gameDoc);

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/players`)
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Charlie' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Cannot add players to a closed game');
  });
});

