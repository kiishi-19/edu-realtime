import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { getSessionById, createBreakoutRoom, getBreakoutRooms } from '@/lib/db';
import { createMeeting } from '@/lib/realtime';

const schema = z.object({ name: z.string().min(1).max(60) });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const rooms = await getBreakoutRooms(id);
  return NextResponse.json({ rooms });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'instructor') {
    return NextResponse.json({ error: 'Only instructors can create breakout rooms' }, { status: 403 });
  }

  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const breakoutMeeting = await createMeeting({ title: `${session.title} — ${parsed.data.name}` });
    const roomId = uuid();
    await createBreakoutRoom({ id: roomId, session_id: id, name: parsed.data.name, meeting_id: breakoutMeeting.id });
    return NextResponse.json({ room: { id: roomId, name: parsed.data.name, meeting_id: breakoutMeeting.id } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create breakout room';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
