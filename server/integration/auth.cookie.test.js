'use strict';

/**
 * Integration tests for auth cookie flow.
 * Tests: login sets cookie, protected routes accept valid cookie,
 * logout clears cookie, protected routes reject after logout.
 * Requirements: 1.2, 1.4, 1.5
 */

// ---------------------------------------------------------------------------
// Set env vars BEFORE requiring the app
// ---------------------------------------------------------------------------
beforeAll(() => {
  process.env.COOKIE_SECRET = 'test-secret';
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password';
  process.env.MONGODB_URI = 'mongodb://localhost/test';
});

// ---------------------------------------------------------------------------
// Mock DB connection and models (no real DB needed)
// ---------------------------------------------------------------------------
jest.mock('../db', () => ({
  connect: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../models/Game');
jest.mock('../models/Round');

const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const Round = require('../models/Round');
const app = require('../app');

// ---------------------------------------------------------------------------
// Helper: build a valid auth_token cookie value
// ---------------------------------------------------------------------------
function makeAuthCookieValue(secret = 'test-secret') {
  const payload = 'admin';
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function makeAuthCookieHeader(secret = 'test-secret') {
  return `auth_token=${makeAuthCookieValue(secret)}`;
}

// ---------------------------------------------------------------------------
// Test: Login sets cookie
// Requirements: 1.2
// ---------------------------------------------------------------------------
describe('POST /api/auth/login — login sets cookie', () => {
  test('returns 200 and sets auth_token cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);

    // Verify Set-Cookie header is present
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(Array.isArray(setCookie)).toBe(true);

    // Verify auth_token cookie is set
    const authCookie = setCookie.find((c) => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();
  });

  test('auth_token cookie has HttpOnly flag', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    const setCookie = res.headers['set-cookie'];
    const authCookie = setCookie.find((c) => c.startsWith('auth_token='));

    expect(authCookie.toLowerCase()).toContain('httponly');
  });

  test('auth_token cookie has Secure flag', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    const setCookie = res.headers['set-cookie'];
    const authCookie = setCookie.find((c) => c.startsWith('auth_token='));

    expect(authCookie.toLowerCase()).toContain('secure');
  });

  test('auth_token cookie has SameSite=Strict', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    const setCookie = res.headers['set-cookie'];
    const authCookie = setCookie.find((c) => c.startsWith('auth_token='));

    expect(authCookie.toLowerCase()).toContain('samesite=strict');
  });

  test('returns 401 and does NOT set cookie on invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wrong', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');

    // No auth_token cookie should be set
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const hasAuthToken = setCookie.some((c) => c.startsWith('auth_token='));
      expect(hasAuthToken).toBe(false);
    }
  });

  test('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('returns 401 on wrong username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wronguser', password: 'password' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test: Protected routes accept valid cookie
// Requirements: 1.4
// ---------------------------------------------------------------------------
describe('Protected routes — accept valid cookie', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/games returns 200 with valid auth cookie', async () => {
    Game.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });

    const res = await request(app)
      .get('/api/games')
      .set('Cookie', makeAuthCookieHeader());

    expect(res.status).toBe(200);
  });

  test('POST /api/games returns 201 with valid auth cookie', async () => {
    const savedGame = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Game',
      players: ['Alice', 'Bob'],
      chipValues: { white: 5, red: 25, green: 50, blue: 125 },
      rakePercent: 2,
      status: 'active',
      createdAt: new Date()
    };

    Game.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue(savedGame)
    }));

    const res = await request(app)
      .post('/api/games')
      .set('Cookie', makeAuthCookieHeader())
      .send({
        name: 'Test Game',
        players: ['Alice', 'Bob'],
        rakePercent: 2
      });

    expect(res.status).toBe(201);
  });

  test('GET /api/games returns 401 without cookie', async () => {
    const res = await request(app).get('/api/games');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
  });

  test('GET /api/games returns 401 with tampered cookie', async () => {
    const tamperedCookie = 'auth_token=admin.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    const res = await request(app)
      .get('/api/games')
      .set('Cookie', tamperedCookie);

    expect(res.status).toBe(401);
  });

  test('GET /api/games returns 401 with cookie signed by wrong secret', async () => {
    const wrongSecretCookie = makeAuthCookieHeader('wrong-secret');

    const res = await request(app)
      .get('/api/games')
      .set('Cookie', wrongSecretCookie);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test: Logout clears cookie
// Requirements: 1.2
// ---------------------------------------------------------------------------
describe('POST /api/auth/logout — logout clears cookie', () => {
  test('returns 200 and clears auth_token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', makeAuthCookieHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);

    // Verify Set-Cookie header clears the auth_token
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();

    const authCookie = setCookie.find((c) => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();

    // A cleared cookie has an empty value or expires in the past
    // cookie-parser's clearCookie sets the value to empty and expires immediately
    const cookieValue = authCookie.split(';')[0].split('=')[1];
    expect(cookieValue).toBe('');
  });

  test('logout works even without a cookie (idempotent)', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Test: Protected routes reject after logout
// Requirements: 1.5
// ---------------------------------------------------------------------------
describe('Protected routes — reject after logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('protected route returns 401 when no cookie is sent (simulating post-logout)', async () => {
    // After logout, the client no longer sends the cookie.
    // Sending a request without the cookie simulates the post-logout state.
    const res = await request(app)
      .get('/api/games');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
  });

  test('protected route returns 401 when cleared (empty) cookie is sent', async () => {
    // Simulate a browser sending the cleared cookie (empty value)
    const res = await request(app)
      .get('/api/games')
      .set('Cookie', 'auth_token=');

    expect(res.status).toBe(401);
  });

  test('full login → access → logout → reject cycle', async () => {
    // Step 1: Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    expect(loginRes.status).toBe(200);

    // Extract the cookie from login response
    const setCookieHeader = loginRes.headers['set-cookie'];
    const authCookieStr = setCookieHeader.find((c) => c.startsWith('auth_token='));
    // Extract just the cookie name=value part (before first semicolon)
    const cookieNameValue = authCookieStr.split(';')[0];

    // Step 2: Access protected route with valid cookie
    Game.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });

    const accessRes = await request(app)
      .get('/api/games')
      .set('Cookie', cookieNameValue);

    expect(accessRes.status).toBe(200);

    // Step 3: Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookieNameValue);

    expect(logoutRes.status).toBe(200);

    // Step 4: Attempt to access protected route without cookie (post-logout)
    const rejectRes = await request(app)
      .get('/api/games');

    expect(rejectRes.status).toBe(401);
  });
});
