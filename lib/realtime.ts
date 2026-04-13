/**
 * Cloudflare RealtimeKit REST API wrapper.
 *
 * RTK API returns { data: {...}, success: true }
 * (not { result: {...} } like the rest of the Cloudflare v4 API).
 *
 * Strategy: We do NOT create presets via API (the schema is complex and
 * changes frequently). Instead we auto-detect the presets that Cloudflare
 * creates by default when you make an RTK app in the dashboard, and map
 * our roles onto the best matching ones.
 */

const BASE_URL = 'https://api.cloudflare.com/client/v4';

function getHeaders() {
  // Accept either CLOUDFLARE_API_TOKEN (local .env.local) or
  // CLOUDFLARE_WORKERS_AI_TOKEN (the secret set on the Worker)
  const token =
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const appId = process.env.CLOUDFLARE_RTK_APP_ID;

  if (!token || token === 'your_api_token_here') {
    throw new Error('No Cloudflare API token found. Set CLOUDFLARE_API_TOKEN in .env.local or CLOUDFLARE_WORKERS_AI_TOKEN as a Worker secret.');
  }
  if (!accountId || accountId === 'your_account_id_here') {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is not set in .env.local');
  }
  if (!appId || appId === 'your_rtk_app_id_here') {
    throw new Error('CLOUDFLARE_RTK_APP_ID is not set in .env.local');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function rtkBase() {
  return `${BASE_URL}/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/realtime/kit/${process.env.CLOUDFLARE_RTK_APP_ID}`;
}

async function assertOk(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`${label} failed (HTTP ${res.status}): ${body}`);
  }
}

// ── Preset auto-detection ─────────────────────────────────────────────────

interface RtkPreset { id: string; name: string }

// In-process cache so we only hit the API once per server lifetime
let _presetCache: RtkPreset[] | null = null;

async function fetchPresets(): Promise<RtkPreset[]> {
  if (_presetCache) return _presetCache;

  const res = await fetch(`${rtkBase()}/presets`, { headers: getHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list presets (HTTP ${res.status}): ${text}`);
  }

  const json = await res.json() as {
    data?: RtkPreset[];
    result?: RtkPreset[];
  };

  _presetCache = json.data ?? json.result ?? [];
  return _presetCache;
}

/**
 * Pick the best matching preset name for a role.
 *
 * Cloudflare creates default presets like:
 *   group-call-host, group-call-participant
 *   webinar-presenter, webinar-viewer
 *   audio-room-host, audio-room-participant
 *
 * We also accept any custom preset named in .env.local:
 *   RTK_INSTRUCTOR_PRESET / RTK_STUDENT_PRESET
 */
export async function resolvePresetName(role: 'instructor' | 'student'): Promise<string> {
  // 1. Explicit override via env var
  if (role === 'instructor' && process.env.RTK_INSTRUCTOR_PRESET) {
    return process.env.RTK_INSTRUCTOR_PRESET;
  }
  if (role === 'student' && process.env.RTK_STUDENT_PRESET) {
    return process.env.RTK_STUDENT_PRESET;
  }

  // 2. Auto-detect from the app's preset list
  const presets = await fetchPresets();
  const names = presets.map((p) => p.name);

  const hostCandidates = [
    'instructor', 'group-call-host', 'group_call_host',
    'host', 'webinar-presenter', 'webinar_presenter',
    'audio-room-host', 'audio_room_host',
  ];
  const participantCandidates = [
    'student', 'group-call-participant', 'group_call_participant',
    'participant', 'webinar-viewer', 'webinar_viewer',
    'audio-room-participant', 'audio_room_participant',
  ];

  const candidates = role === 'instructor' ? hostCandidates : participantCandidates;

  // Exact match first
  for (const c of candidates) {
    if (names.includes(c)) return c;
  }

  // Fuzzy match — any preset whose name contains "host" or "participant"
  const keyword = role === 'instructor' ? 'host' : 'participant';
  const fuzzy = names.find((n) => n.toLowerCase().includes(keyword));
  if (fuzzy) return fuzzy;

  // Last resort — just use whatever is first/second in the list
  if (presets.length === 0) {
    throw new Error(
      `No presets found in your RTK app. ` +
      `Go to https://dash.cloudflare.com → Realtime → Kit → your app → Presets and create at least two presets (host + participant). ` +
      `Then set RTK_INSTRUCTOR_PRESET and RTK_STUDENT_PRESET in .env.local.`
    );
  }

  // Pick first for instructor, second (or first) for student
  return role === 'instructor' ? presets[0].name : (presets[1] ?? presets[0]).name;
}

/** No-op — presets are managed via the Cloudflare dashboard, not created by the app. */
export async function ensurePresets(): Promise<void> {
  // Validate that we can reach the API and have at least one preset
  await resolvePresetName('instructor');
  await resolvePresetName('student');
}

// ── Meetings ──────────────────────────────────────────────────────────────

export async function createMeeting(options: {
  title: string;
  ai_enabled?: boolean;
}): Promise<{ id: string; title: string }> {
  const body: Record<string, unknown> = { title: options.title };

  if (options.ai_enabled) {
    body.ai_config = {
      transcription: { language: 'en-US' },
      summarization: {
        word_limit: 500,
        text_format: 'markdown',
        summary_type: 'lecture',
      },
    };
    body.summarize_on_end = true;
  }

  const res = await fetch(`${rtkBase()}/meetings`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  await assertOk(res, 'Create meeting');
  const json = await res.json() as { data: { id: string; title: string } };
  return json.data;
}

export async function createConnectedMeeting(
  parentMeetingId: string,
  name: string
): Promise<{ id: string; title: string }> {
  const res = await fetch(`${rtkBase()}/meetings/${parentMeetingId}/connected-meetings`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title: name }),
  });

  await assertOk(res, 'Create connected meeting');
  const json = await res.json() as { data: { id: string; title: string } };
  return json.data;
}

// ── Participants ──────────────────────────────────────────────────────────

export async function addParticipant(options: {
  meetingId: string;
  name: string;
  presetName: 'instructor' | 'student' | 'ai-assistant';
  customParticipantId: string;
}): Promise<{ id: string; token: string }> {
  // Resolve the actual RTK preset name from the role
  const resolvedPreset = options.presetName === 'ai-assistant'
    ? await resolvePresetName('student')   // ai-assistant uses student-level access
    : await resolvePresetName(options.presetName);

  const body = {
    name: options.name,
    preset_name: resolvedPreset,
    custom_participant_id: options.customParticipantId,
  };

  const res = await fetch(`${rtkBase()}/meetings/${options.meetingId}/participants`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  await assertOk(res, 'Add participant');
  const json = await res.json() as { data: { id: string; token: string } };
  return json.data;
}

// ── Session summary ───────────────────────────────────────────────────────

export async function getSessionSummary(sessionId: string): Promise<{ summary: string } | null> {
  const res = await fetch(`${rtkBase()}/sessions/${sessionId}/summary`, {
    headers: getHeaders(),
  });
  if (!res.ok) return null;
  const json = await res.json() as { data: { summary: string } };
  return json.data;
}
