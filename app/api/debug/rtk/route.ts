/**
 * GET /api/debug/rtk
 *
 * Validates your Cloudflare credentials by listing presets.
 * Only runs in development — returns 404 in production.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const appId = process.env.CLOUDFLARE_RTK_APP_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  const missing = [];
  if (!accountId || accountId === 'your_account_id_here') missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!appId || appId === 'your_rtk_app_id_here') missing.push('CLOUDFLARE_RTK_APP_ID');
  if (!token || token === 'your_api_token_here') missing.push('CLOUDFLARE_API_TOKEN');

  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      error: `Missing env vars: ${missing.join(', ')}`,
      hint: 'Fill in .env.local and restart the dev server',
    }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/presets`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await res.json() as { data?: unknown[]; result?: unknown[]; errors?: unknown[] };

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        status: res.status,
        response: json,
        hint: res.status === 401
          ? 'API token is invalid or missing Realtime permissions'
          : res.status === 404
          ? 'CLOUDFLARE_RTK_APP_ID is invalid or the app does not exist'
          : 'Unexpected error from Cloudflare API',
      }, { status: 502 });
    }

    const presets = (json.data ?? json.result ?? []) as Array<{ id: string; name: string }>;
    const names = presets.map((p) => p.name);

    // Show which preset the app will auto-select for each role
    const hostCandidates = ['instructor','group-call-host','group_call_host','host','webinar-presenter'];
    const participantCandidates = ['student','group-call-participant','group_call_participant','participant','webinar-viewer'];

    const resolvedInstructor =
      process.env.RTK_INSTRUCTOR_PRESET ??
      hostCandidates.find((c) => names.includes(c)) ??
      names.find((n) => n.toLowerCase().includes('host')) ??
      names[0] ?? '(none)';

    const resolvedStudent =
      process.env.RTK_STUDENT_PRESET ??
      participantCandidates.find((c) => names.includes(c)) ??
      names.find((n) => n.toLowerCase().includes('participant')) ??
      names[1] ?? names[0] ?? '(none)';

    return NextResponse.json({
      ok: true,
      presets,
      resolved: {
        instructor: resolvedInstructor,
        student: resolvedStudent,
      },
      message: `Connected! Found ${presets.length} preset(s). Instructor → "${resolvedInstructor}", Student → "${resolvedStudent}".`,
      hint: presets.length === 0
        ? 'No presets found. Go to Cloudflare Dashboard → Realtime → Kit → your app → Presets and ensure at least two presets exist.'
        : undefined,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
