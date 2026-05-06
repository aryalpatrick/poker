'use strict';

/**
 * Property-based tests for the Games API router.
 * Uses fast-check to verify universal properties.
 * DB models are mocked — no real MongoDB connection required.
 */

const fc = require('fast-check');
const request = require('supertest');

// ---------------------------------------------------------------------------
// Set env vars BEFORE requiring the app so requireAuth and db.js work
// ---------------------------------------------------------------------------
beforeAll(() => {
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
function makeAuthCookie() {
  const value = Buffer.from('admin:password').toString('base64');
  return `auth_token=${value}`;
}

const AUTH_COOKIE = makeAuthCookie();

// ---------------------------------------------------------------------------
// Property 7: Whitespace-only or empty player names are rejected
// Feature: poker-app, Property 7: Whitespace-only or empty player names are rejected
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe('Property 7: Whitespace-only or empty player names are rejected', () => {
  // Arbitrary: a string that is empty or consists only of whitespace characters
  const whitespaceStringArb = fc.oneof(
    fc.constant(''),
    fc.stringOf(
      fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'),
      { minLength: 1, maxLength: 10 }
    )
  );

  // A player list where at least one entry is whitespace-only or empty,
  // and the total length is >= 2 so the "min 2 players" rule doesn't fire first
  const playersWithBadNameArb = fc
    .tuple(
      // at least one valid player before the bad one
      fc.array(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
        { minLength: 1, maxLength: 3 }
      ),
      whitespaceStringArb,
      // optional valid players after
      fc.array(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
        { minLength: 0, maxLength: 3 }
      )
    )
    .map(([before, bad, after]) => [...before, bad, ...after]);

  beforeEach(() => {
    // Reset save mock before each run
    Game.mockImplementation(() => ({ save: jest.fn() }));
  });

  test('game creation returns 400 when any player name is whitespace-only or empty', async () => {
    await fc.assert(
      fc.asyncProperty(playersWithBadNameArb, async (players) => {
        const saveMock = jest.fn();
        Game.mockImplementation(() => ({ save: saveMock }));

        const res = await request(app)
          .post('/api/games')
          .set('Cookie', AUTH_COOKIE)
          .send({ name: 'Test Game', players, rakePercent: 2 });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        // The game should NOT have been saved
        expect(saveMock).not.toHaveBeenCalled();
      }),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Game list is ordered by creation date descending
// Feature: poker-app, Property 10: Game list is ordered by creation date descending
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------

describe('Property 10: Game list is ordered by creation date descending', () => {
  // Arbitrary: array of game-like objects with random createdAt timestamps
  const gamesArb = fc.array(
    fc.record({
      _id: fc.integer({ min: 1, max: 1_000_000 }).map((n) => ({
        toString: () => String(n)
      })),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      players: fc.array(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
        { minLength: 2, maxLength: 5 }
      ),
      rakePercent: fc.constantFrom(1, 2, 2.5, 3, 5),
      status: fc.constantFrom('active', 'closed'),
      createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
    }),
    { minLength: 0, maxLength: 10 }
  );

  test('GET /api/games returns games sorted by createdAt descending', async () => {
    await fc.assert(
      fc.asyncProperty(gamesArb, async (games) => {
        // Simulate what MongoDB returns after sort({ createdAt: -1 })
        const sortedGames = [...games].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );

        // Mock Game.find() → sort() → lean() chain
        const leanMock = jest.fn().mockResolvedValue(sortedGames);
        const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
        Game.find = jest.fn().mockReturnValue({ sort: sortMock });

        // Mock Round.aggregate() to return empty rake totals
        Round.aggregate = jest.fn().mockResolvedValue([]);

        const res = await request(app)
          .get('/api/games')
          .set('Cookie', AUTH_COOKIE);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(games.length);

        // Verify the router called sort with the correct descending argument
        expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });

        // Verify the response is sorted descending by createdAt
        for (let i = 0; i < res.body.length - 1; i++) {
          const curr = new Date(res.body[i].createdAt).getTime();
          const next = new Date(res.body[i + 1].createdAt).getTime();
          expect(curr).toBeGreaterThanOrEqual(next);
        }
      }),
      { numRuns: 25 }
    );
  });
});
