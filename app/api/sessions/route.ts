import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { createSession, getAllSessions, getSessionsByInstructor } from '@/lib/db';
import { createMeeting, ensurePresets } from '@/lib/realtime';
import { generateJoinCode } from '@/lib/utils';

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  scheduled_at: z.string().optional(),
  max_students: z.number().int().min(1).max(500).default(100),
  ai_enabled: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get('mine') === 'true';

  const sessions = mine && user.role === 'instructor'
    ? await getSessionsByInstructor(user.id)
    : await getAllSessions(50);

  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'instructor') {
    return NextResponse.json({ error: 'Only instructors can create sessions' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { title, description, scheduled_at, max_students, ai_enabled } = parsed.data;

    // Ensure presets exist in RealtimeKit (creates them if missing)
    await ensurePresets();

    // Create the RealtimeKit meeting
    const meeting = await createMeeting({ title, ai_enabled });

    const id = uuid();
    const join_code = generateJoinCode();

    await createSession({
      id,
      title,
      description,
      meeting_id: meeting.id,
      instructor_id: user.id,
      scheduled_at,
      max_students,
      ai_enabled,
      join_code,
    });

    return NextResponse.json({ session: { id, title, meeting_id: meeting.id, join_code } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create session';
    console.error('Create session error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
