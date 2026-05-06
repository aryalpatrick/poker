'use strict';

beforeAll(() => {
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password';
  process.env.MONGODB_URI = 'mongodb://localhost/test';
});

jest.mock('../db', () => ({ connect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../models/Game');
jest.mock('../models/Round');

const request = require('supertest');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const app = require('../app');

function validCookieHeader() {
  const value = Buffer.from('admin:password').toString('base64');
  return `auth_token=${value}`;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  test('returns 200 and sets auth_token cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const authCookie = setCookie.find(c => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();
  });

  test('auth_token cookie has Secure flag', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    const setCookie = res.headers['set-cookie'];
    const authCookie = setCookie.find(c => c.startsWith('auth_token='));
    expect(authCookie.toLowerCase()).toContain('secure');
  });

  test('auth_token cookie has SameSite=Strict', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    const setCookie = res.headers['set-cookie'];
    const authCookie = setCookie.find(c => c.startsWith('auth_token='));
    expect(authCookie.toLowerCase()).toContain('samesite=strict');
  });

  test('returns 401 and does NOT set cookie on invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wrong', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');

    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      expect(setCookie.some(c => c.startsWith('auth_token='))).toBe(false);
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
// Protected routes
// ---------------------------------------------------------------------------
describe('Protected routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /api/games returns 200 with valid auth cookie', async () => {
    Game.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) })
    });

    const res = await request(app)
      .get('/api/games')
      .set('Cookie', validCookieHeader());

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
      .set('Cookie', validCookieHeader())
      .send({ name: 'Test Game', players: ['Alice', 'Bob'], rakePercent: 2 });

    expect(res.status).toBe(201);
  });

  test('GET /api/games returns 401 without cookie', async () => {
    const res = await request(app).get('/api/games');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
  });

  test('GET /api/games returns 401 with wrong cookie value', async () => {
    const res = await request(app)
      .get('/api/games')
      .set('Cookie', 'auth_token=totallyWrongValue');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
describe('POST /api/auth/logout', () => {
  test('returns 200 and clears auth_token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', validCookieHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const authCookie = setCookie.find(c => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();
    const cookieValue = authCookie.split(';')[0].split('=')[1];
    expect(cookieValue).toBe('');
  });

  test('logout works even without a cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Full cycle
// ---------------------------------------------------------------------------
describe('Full login → access → logout → reject cycle', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cycle works end to end', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });
    expect(loginRes.status).toBe(200);

    const cookieNameValue = loginRes.headers['set-cookie']
      .find(c => c.startsWith('auth_token='))
      .split(';')[0];

    Game.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) })
    });

    const accessRes = await request(app)
      .get('/api/games')
      .set('Cookie', cookieNameValue);
    expect(accessRes.status).toBe(200);

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookieNameValue);
    expect(logoutRes.status).toBe(200);

    const rejectRes = await request(app).get('/api/games');
    expect(rejectRes.status).toBe(401);
  });
});
