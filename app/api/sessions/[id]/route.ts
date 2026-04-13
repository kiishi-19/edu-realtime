import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getSessionById, getSessionParticipants, updateSessionStatus } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const participants = await getSessionParticipants(id);
  return NextResponse.json({ session, participants });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (session.instructor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body;
  if (status && ['scheduled', 'active', 'ended'].includes(status)) {
    await updateSessionStatus(id, status);
  }
  return NextResponse.json({ success: true });
}
