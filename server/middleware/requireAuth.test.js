'use strict';

const crypto = require('crypto');

// Set env vars before requiring the module
beforeAll(() => {
  process.env.COOKIE_SECRET = 'test-secret';
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password';
});

const requireAuth = require('./requireAuth');
const { hmac } = requireAuth;

/**
 * Build a mock Express req/res/next triple for testing middleware.
 */
function buildMocks({ cookies = {} } = {}) {
  const req = { cookies };
  const res = {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  const next = jest.fn();
  return { req, res, next };
}

/**
 * Create a valid signed cookie value for the given payload.
 */
function makeValidCookie(payload, secret = 'test-secret') {
  const sig = hmac(payload, secret);
  return `${payload}.${sig}`;
}

// Requirements: 1.4, 1.5

describe('requireAuth middleware', () => {
  test('valid cookie calls next()', () => {
    const { req, res, next } = buildMocks({
      cookies: { auth_token: makeValidCookie('admin') },
    });

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBeNull();
  });

  test('missing cookie returns 401', () => {
    const { req, res, next } = buildMocks({ cookies: {} });

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Unauthorized' });
  });

  test('tampered cookie (wrong signature) returns 401', () => {
    const tampered = 'admin.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const { req, res, next } = buildMocks({
      cookies: { auth_token: tampered },
    });

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Unauthorized' });
  });

  test('cookie signed with wrong secret returns 401', () => {
    const wrongSecretCookie = makeValidCookie('admin', 'wrong-secret');
    const { req, res, next } = buildMocks({
      cookies: { auth_token: wrongSecretCookie },
    });

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Unauthorized' });
  });

  test('cookie with no dot separator returns 401', () => {
    const { req, res, next } = buildMocks({
      cookies: { auth_token: 'nodothere' },
    });

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Unauthorized' });
  });
});
