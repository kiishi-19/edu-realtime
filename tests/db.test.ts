import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuid } from 'uuid';

let db: typeof import('@/lib/db');

beforeEach(async () => {
  vi.resetModules();
  db = await import('@/lib/db');
});

describe('User operations', () => {
  it('creates a user and retrieves by email', async () => {
    const id = uuid();
    await db.createUser({ id, email: `${id}@test.com`, password_hash: 'hash', name: 'Test User', role: 'student' });
    const user = await db.getUserByEmail(`${id}@test.com`);
    expect(user).toBeDefined();
    expect(user?.name).toBe('Test User');
    expect(user?.role).toBe('student');
    expect(user?.id).toBe(id);
  });

  it('retrieves a user by id', async () => {
    const id = uuid();
    await db.createUser({ id, email: `${id}@test.com`, password_hash: 'hash2', name: 'Another User', role: 'instructor' });
    const user = await db.getUserById(id);
    expect(user).toBeDefined();
    expect(user?.role).toBe('instructor');
  });

  it('returns undefined for a non-existent user', async () => {
    expect(await db.getUserByEmail('nobody@nowhere.com')).toBeUndefined();
    expect(await db.getUserById('00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });

  it('throws on duplicate email', async () => {
    const id1 = uuid();
    const id2 = uuid();
    await db.createUser({ id: id1, email: 'dup@test.com', password_hash: 'h', name: 'A', role: 'student' });
    await expect(
      db.createUser({ id: id2, email: 'dup@test.com', password_hash: 'h', name: 'B', role: 'student' })
    ).rejects.toThrow();
  });
});

describe('Session operations', () => {
  async function makeUser(role: 'instructor' | 'student' = 'instructor') {
    const id = uuid();
    await db.createUser({ id, email: `${id}@test.com`, password_hash: 'h', name: 'Inst', role });
    return id;
  }

  it('creates and retrieves a session', async () => {
    const instructorId = await makeUser();
    const sessionId = uuid();
    await db.createSession({ id: sessionId, title: 'Test Class', meeting_id: 'rtk-1', instructor_id: instructorId, join_code: 'ABC123' });
    const session = await db.getSessionById(sessionId);
    expect(session).toBeDefined();
    expect(session?.title).toBe('Test Class');
    expect(session?.status).toBe('scheduled');
    expect(session?.ai_enabled).toBe(1);
  });

  it('retrieves a session by join code', async () => {
    const instructorId = await makeUser();
    const sessionId = uuid();
    await db.createSession({ id: sessionId, title: 'By Code', meeting_id: 'rtk-2', instructor_id: instructorId, join_code: 'XYZ999' });
    const session = await db.getSessionByJoinCode('XYZ999');
    expect(session?.id).toBe(sessionId);
  });

  it('updates session status', async () => {
    const instructorId = await makeUser();
    const sessionId = uuid();
    await db.createSession({ id: sessionId, title: 'Status Test', meeting_id: 'rtk-3', instructor_id: instructorId, join_code: 'ST1234' });

    await db.updateSessionStatus(sessionId, 'active');
    expect((await db.getSessionById(sessionId))?.status).toBe('active');

    await db.updateSessionStatus(sessionId, 'ended');
    const ended = await db.getSessionById(sessionId);
    expect(ended?.status).toBe('ended');
    expect(ended?.ended_at).not.toBeNull();
  });

  it('returns undefined for non-existent session', async () => {
    expect(await db.getSessionById('no-such-id')).toBeUndefined();
    expect(await db.getSessionByJoinCode('XXXXXX')).toBeUndefined();
  });
});

describe('Session participants', () => {
  it('upserts a participant without duplicates', async () => {
    const instructorId = uuid();
    const studentId = uuid();
    await db.createUser({ id: instructorId, email: `${instructorId}@t.com`, password_hash: 'h', name: 'I', role: 'instructor' });
    await db.createUser({ id: studentId, email: `${studentId}@t.com`, password_hash: 'h', name: 'S', role: 'student' });
    const sessionId = uuid();
    await db.createSession({ id: sessionId, title: 'P Test', meeting_id: 'rtk-p', instructor_id: instructorId, join_code: 'PART56' });

    await db.upsertSessionParticipant({ id: uuid(), session_id: sessionId, user_id: studentId, role: 'student', rtk_participant_id: 'p1' });
    await db.upsertSessionParticipant({ id: uuid(), session_id: sessionId, user_id: studentId, role: 'student', rtk_participant_id: 'p2' });

    const participants = await db.getSessionParticipants(sessionId);
    const studentRows = participants.filter((p) => p.user_id === studentId);
    expect(studentRows).toHaveLength(1);
    expect(studentRows[0].rtk_participant_id).toBe('p2');
  });
});

describe('Breakout rooms', () => {
  it('creates and retrieves breakout rooms', async () => {
    const instructorId = uuid();
    await db.createUser({ id: instructorId, email: `${instructorId}@t.com`, password_hash: 'h', name: 'I', role: 'instructor' });
    const sessionId = uuid();
    await db.createSession({ id: sessionId, title: 'B Test', meeting_id: 'rtk-b', instructor_id: instructorId, join_code: 'BR1234' });

    await db.createBreakoutRoom({ id: uuid(), session_id: sessionId, name: 'Group A', meeting_id: 'rtk-ba' });
    await db.createBreakoutRoom({ id: uuid(), session_id: sessionId, name: 'Group B', meeting_id: 'rtk-bb' });

    const rooms = await db.getBreakoutRooms(sessionId);
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => r.name).sort()).toEqual(['Group A', 'Group B']);
  });

  it('returns empty array for a session with no rooms', async () => {
    expect(await db.getBreakoutRooms('nonexistent-session')).toEqual([]);
  });
});
