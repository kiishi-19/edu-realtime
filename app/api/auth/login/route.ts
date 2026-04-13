import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail } from '@/lib/db';
import { verifyPassword, signToken, setAuthCookie } from '@/lib/auth';
import { cookies } from 'next/headers';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
    }

    const { email, password } = parsed.data;

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const cookieConfig = setAuthCookie(token);

    const cookieStore = await cookies();
    cookieStore.set(cookieConfig.name, cookieConfig.value, cookieConfig.options as Parameters<typeof cookieStore.set>[2]);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
