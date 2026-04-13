import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionByJoinCode } from '@/lib/db';

const schema = z.object({ code: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid join code' }, { status: 400 });
  }

  const code = parsed.data.code.toUpperCase().trim();
  if (code.length !== 6) {
    return NextResponse.json({ error: 'Code must be 6 characters' }, { status: 400 });
  }

  const session = await getSessionByJoinCode(code);
  if (!session) {
    return NextResponse.json({ error: 'Session not found — check the code and try again' }, { status: 404 });
  }

  return NextResponse.json({
    session_id: session.id,
    title: session.title,
    instructor: session.instructor_name,
    status: session.status,
  });
}
