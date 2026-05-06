'use strict';

// Feature: poker-app, Property 9: Invalid credentials always return 401

const fc = require('fast-check');
const request = require('supertest');

// Set env vars before requiring the app
beforeAll(() => {
  process.env.COOKIE_SECRET = 'test-secret';
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password';
});

// Require app after env vars are set
const app = require('../app');

/**
 * Property 9: Invalid credentials always return 401
 *
 * For any username/password pair that does not exactly match AUTH_USERNAME and AUTH_PASSWORD,
 * the Auth_Service SHALL return a 401 response and SHALL NOT set an auth cookie.
 *
 * Validates: Requirements 1.3
 */
describe('Property 9: Invalid credentials always return 401', () => {
  test('random credentials not matching env vars always return 401 with no Set-Cookie', async () => {
    const validUsername = process.env.AUTH_USERNAME;
    const validPassword = process.env.AUTH_PASSWORD;

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string(),
          password: fc.string(),
        }),
        async ({ username, password }) => {
          // Ensure the pair does NOT match the valid credentials
          fc.pre(username !== validUsername || password !== validPassword);

          const res = await request(app)
            .post('/api/auth/login')
            .send({ username, password })
            .set('Content-Type', 'application/json');

          // Must return 401
          if (res.status !== 401) return false;

          // Must not set an auth cookie
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            const hasAuthToken = setCookie.some((c) => c.startsWith('auth_token='));
            if (hasAuthToken) return false;
          }

          return true;
        }
      ),
      { numRuns: 25 }
    );
  });
});
