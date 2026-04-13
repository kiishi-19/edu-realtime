/**
 * Integration tests for auth API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// next/headers cookies mock
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return actual;
});

import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';

function makeRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  it('returns 400 for missing fields', async () => {
    const res = await register(makeRequest({ email: 'x@y.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid email', async () => {
    const res = await register(makeRequest({ name: 'Test', email: 'not-an-email', password: 'password123', role: 'student' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a password shorter than 8 chars', async () => {
    const res = await register(makeRequest({ name: 'Test', email: 'ok@test.com', password: 'short', role: 'student' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid role', async () => {
    const res = await register(makeRequest({ name: 'Test', email: 'ok@test.com', password: 'password123', role: 'admin' }));
    expect(res.status).toBe(400);
  });

  it('registers a new user successfully', async () => {
    const email = `test-${Date.now()}@example.com`;
    const res = await register(makeRequest({ name: 'New User', email, password: 'secure1234', role: 'student' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { email: string; role: string } };
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('student');
  });

  it('returns 409 for a duplicate email', async () => {
    const email = `dup-${Date.now()}@example.com`;
    await register(makeRequest({ name: 'First', email, password: 'password123', role: 'student' }));
    const res = await register(makeRequest({ name: 'Second', email, password: 'password123', role: 'instructor' }));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 for non-existent user', async () => {
    const res = await login(makeRequest({ email: 'nobody@nowhere.com', password: 'password' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    const email = `login-test-${Date.now()}@example.com`;
    await register(makeRequest({ name: 'Login Test', email, password: 'correctpass', role: 'instructor' }));

    const res = await login(makeRequest({ email, password: 'wrongpass' }));
    expect(res.status).toBe(401);
  });

  it('logs in successfully with correct credentials', async () => {
    const email = `login-ok-${Date.now()}@example.com`;
    await register(makeRequest({ name: 'Login OK', email, password: 'mypassword', role: 'instructor' }));

    const res = await login(makeRequest({ email, password: 'mypassword' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { email: string; role: string } };
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('instructor');
  });
});
