import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { createUser, getUserByEmail } from '@/lib/db';
import { hashPassword, signToken, setAuthCookie } from '@/lib/auth';
import { cookies } from 'next/headers';

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['instructor', 'student']),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const id = uuid();
    const password_hash = await hashPassword(password);

    await createUser({ id, email, password_hash, name, role });

    const token = signToken({ userId: id, email, role });
    const cookieConfig = setAuthCookie(token);

    const cookieStore = await cookies();
    cookieStore.set(cookieConfig.name, cookieConfig.value, cookieConfig.options as Parameters<typeof cookieStore.set>[2]);

    return NextResponse.json({
      user: { id, name, email, role },
    });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
