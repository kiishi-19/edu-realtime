import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getUserById } from './db';
import { v4 as uuid } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'edu-realtime-dev-secret-change-in-prod';
const COOKIE_NAME = 'edu_token';

// ── Shared types ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'instructor' | 'student';
  isGuest?: boolean;
}

// ── Password utils ────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Registered user tokens ────────────────────────────────────────────────

interface UserPayload { userId: string; email: string; role: string }

export function signToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

// ── Guest tokens ──────────────────────────────────────────────────────────
// A guest has no account — they join via a session code + display name.
// The token expires when the session would reasonably end (24 h).

interface GuestPayload {
  guestId: string;
  name: string;
  role: 'student';
  isGuest: true;
}

export function signGuestToken(name: string): string {
  const payload: GuestPayload = {
    guestId: uuid(),
    name,
    role: 'student',
    isGuest: true,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyGuestToken(token: string): GuestPayload | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as GuestPayload;
    return p.isGuest === true ? p : null;
  } catch {
    return null;
  }
}

// ── getAuthUser — resolves both registered users and guests ───────────────

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  // Try guest token first (it has isGuest: true in the payload)
  const guestPayload = verifyGuestToken(token);
  if (guestPayload) {
    return {
      id: guestPayload.guestId,
      name: guestPayload.name,
      email: `${guestPayload.guestId}@guest`,
      role: 'student',
      isGuest: true,
    };
  }

  // Fall back to registered user
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await getUserById(payload.userId);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as 'instructor' | 'student',
    isGuest: false,
  };
}

// ── Cookie helpers ────────────────────────────────────────────────────────

export function setAuthCookie(token: string): { name: string; value: string; options: object } {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    },
  };
}

// For guest cookies we use a shorter maxAge matching the token
export function setGuestCookie(token: string): { name: string; value: string; options: object } {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 h
      path: '/',
    },
  };
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
