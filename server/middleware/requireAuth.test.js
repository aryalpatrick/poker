'use strict';

beforeAll(() => {
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password';
});

const requireAuth = require('./requireAuth');

function buildMocks({ cookies = {} } = {}) {
  const req = { cookies };
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body)   { this._body = body;   return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

function validCookie() {
  return Buffer.from('admin:password').toString('base64');
}

describe('requireAuth middleware', () => {
  test('valid cookie calls next()', () => {
    const { req, res, next } = buildMocks({ cookies: { auth_token: validCookie() } });
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

  test('wrong cookie value returns 401', () => {
    const { req, res, next } = buildMocks({ cookies: { auth_token: 'wrongvalue' } });
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Unauthorized' });
  });

  test('empty cookie returns 401', () => {
    const { req, res, next } = buildMocks({ cookies: { auth_token: '' } });
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });
});
