import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getAuthUser } from '@/lib/auth';
import { getSessionById, upsertSessionParticipant } from '@/lib/db';
import { addParticipant, ensurePresets } from '@/lib/realtime';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (session.status === 'ended') {
    return NextResponse.json({ error: 'This session has ended' }, { status: 410 });
  }

  try {
    await ensurePresets();

    // Guests are always students; registered users may be instructors
    const role: 'instructor' | 'student' =
      !user.isGuest &&
      (session.instructor_id === user.id || session.co_instructor_id === user.id)
        ? 'instructor'
        : 'student';

    const participant = await addParticipant({
      meetingId: session.meeting_id,
      name: user.name,
      presetName: role,
      customParticipantId: user.id,
    });

    // Only upsert registered users — guests have no user row in the DB.
    if (!user.isGuest) {
      await upsertSessionParticipant({
        id: uuid(),
        session_id: id,
        user_id: user.id,
        role,
        rtk_participant_id: participant.id,
      });
    }

    return NextResponse.json({
      auth_token: participant.token,
      role,
      meeting_id: session.meeting_id,
      session_title: session.title,
      custom_participant_id: user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to join session';
    console.error('Join session error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
