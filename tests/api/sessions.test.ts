import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { v4 as uuid } from 'uuid';

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }));
vi.mock('@/lib/realtime', () => ({
  ensurePresets: vi.fn().mockResolvedValue(undefined),
  createMeeting: vi.fn().mockResolvedValue({ id: 'rtk-meeting-abc', title: 'Test' }),
  addParticipant: vi.fn().mockResolvedValue({ id: 'p-1', token: 'auth-token-xyz' }),
}));
vi.mock('@/lib/db', () => ({
  getAllSessions: vi.fn().mockResolvedValue([]),
  getSessionsByInstructor: vi.fn().mockResolvedValue([]),
  createSession: vi.fn().mockResolvedValue(undefined),
}));

import { getAuthUser } from '@/lib/auth';
import { GET as getSessions, POST as createSession } from '@/app/api/sessions/route';

function makeRequest(body?: object) {
  return new NextRequest('http://localhost/api/sessions', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Fresh instructor ID per test file run so no UNIQUE conflicts
const instructorId = uuid();
const instructor = { id: instructorId, name: 'Prof', email: `prof-${instructorId}@t.com`, role: 'instructor' as const };
const student = { id: uuid(), name: 'Stu', email: `stu-${instructorId}@t.com`, role: 'student' as const };



describe('GET /api/sessions', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await getSessions(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns sessions array for authenticated user', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(instructor);
    const res = await getSessions(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { sessions: unknown[] };
    expect(Array.isArray(body.sessions)).toBe(true);
  });
});

describe('POST /api/sessions', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await createSession(makeRequest({ title: 'Test', ai_enabled: false }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when a student tries to create a session', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(student);
    const res = await createSession(makeRequest({ title: 'Test', ai_enabled: false }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing title', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(instructor);
    const res = await createSession(makeRequest({ ai_enabled: false }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a title that is too short', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(instructor);
    const res = await createSession(makeRequest({ title: 'AB', ai_enabled: false }));
    expect(res.status).toBe(400);
  });

  it('creates a session and returns id + join_code', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(instructor);
    const res = await createSession(makeRequest({ title: 'Intro to Algorithms', ai_enabled: false }));
    expect(res.status).toBe(201);
    const body = await res.json() as { session: { id: string; join_code: string; meeting_id: string } };
    expect(body.session.id).toBeTruthy();
    expect(body.session.join_code).toHaveLength(6);
    expect(body.session.meeting_id).toBe('rtk-meeting-abc');
  });
});
