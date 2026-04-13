import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getSessionById } from '@/lib/db';
import { generateSessionSummary } from '@/lib/ai';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcript required' }, { status: 400 });
    }

    const summary = await generateSessionSummary(transcript, session.title);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('Summary error:', err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
