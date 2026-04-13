import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { getBreakoutRooms } from '@/lib/db';
import { addParticipant, ensurePresets } from '@/lib/realtime';

// Accept either a DB room_id (legacy) OR a direct RTK meeting_id (for rooms
// created through the meeting UI's built-in connected meetings feature)
const schema = z.object({
  room_id: z.string().optional(),
  meeting_id: z.string().optional(),
}).refine((d) => d.room_id || d.meeting_id, { message: 'room_id or meeting_id required' });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let meetingId: string;
  let roomName: string = 'Breakout Room';

  if (parsed.data.meeting_id) {
    // RTK-native room — meeting_id comes directly from connectedMeetings
    meetingId = parsed.data.meeting_id;
  } else {
    // Legacy DB room lookup
  const rooms = await getBreakoutRooms(id);
  const room = rooms.find((r) => r.id === parsed.data.room_id);
    if (!room) return NextResponse.json({ error: 'Breakout room not found' }, { status: 404 });
    meetingId = room.meeting_id;
    roomName = room.name;
  }

  try {
    await ensurePresets();
    const presetName = user.role === 'instructor' ? 'instructor' : 'student';

    const participant = await addParticipant({
      meetingId,
      name: user.name,
      presetName,
      customParticipantId: user.id,
    });

    return NextResponse.json({
      auth_token: participant.token,
      meeting_id: meetingId,
      room_name: roomName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to join breakout room';
    console.error('Join breakout error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
