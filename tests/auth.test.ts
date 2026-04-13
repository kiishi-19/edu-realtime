import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from '@/lib/auth';

describe('hashPassword / verifyPassword', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('MySecurePassword123');
    expect(hash).not.toBe('MySecurePassword123');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
    await expect(verifyPassword('MySecurePassword123', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-password');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('produces different hashes for the same password', async () => {
    const h1 = await hashPassword('password');
    const h2 = await hashPassword('password');
    expect(h1).not.toBe(h2); // bcrypt uses a random salt
  });
});

describe('signToken / verifyToken', () => {
  const payload = { userId: 'user-123', email: 'test@example.com', role: 'instructor' };

  it('signs and verifies a token', () => {
    const token = signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT = header.payload.signature

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('user-123');
    expect(decoded?.email).toBe('test@example.com');
    expect(decoded?.role).toBe('instructor');
  });

  it('returns null for an invalid token', () => {
    expect(verifyToken('not.a.valid.token')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('returns null for a tampered token', () => {
    const token = signToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyToken(tampered)).toBeNull();
  });
});
