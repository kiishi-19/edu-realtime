/**
 * POST /api/auth/guest
 *
 * Validates a session join code + display name, issues a short-lived guest
 * JWT, and returns the session details so the client can redirect to the
 * classroom. No account is created.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionByJoinCode } from '@/lib/db';
import { signGuestToken, setGuestCookie } from '@/lib/auth';
import { cookies } from 'next/headers';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(2).max(60).trim(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { code, name } = parsed.data;

    const session = await getSessionByJoinCode(code.toUpperCase());
    if (!session) {
      return NextResponse.json({ error: 'Invalid access code — double-check with your instructor' }, { status: 404 });
    }

    if (session.status === 'ended') {
      return NextResponse.json({ error: 'This session has already ended' }, { status: 410 });
    }

    // Issue a guest token — no DB write needed
    const token = signGuestToken(name);
    const cookieConfig = setGuestCookie(token);

    const cookieStore = await cookies();
    cookieStore.set(
      cookieConfig.name,
      cookieConfig.value,
      cookieConfig.options as Parameters<typeof cookieStore.set>[2]
    );

    return NextResponse.json({
      session_id: session.id,
      session_title: session.title,
      instructor: session.instructor_name,
    });
  } catch (err) {
    console.error('Guest join error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
