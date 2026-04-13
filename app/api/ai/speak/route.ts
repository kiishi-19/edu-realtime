/**
 * POST /api/ai/speak
 * Converts text to audio and streams it back as audio/mpeg.
 *
 * Priority:
 *   1. ElevenLabs  — if ELEVENLABS_API_KEY is set (best quality, free tier = 10k chars/mo)
 *   2. Cloudflare Workers AI TTS (@cf/myshell-ai/melotts) — uses existing CF credentials
 *
 * To use ElevenLabs, add to .env.local:
 *   ELEVENLABS_API_KEY=your_key
 *   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   (optional, Rachel is default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// Strip markdown so TTS doesn't read "asterisk asterisk"
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'code block.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

async function elevenLabsTTS(text: string): Promise<Response | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;

  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.slice(0, 1000), // ElevenLabs free tier limit
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) return null;
  return res;
}

async function cloudflareWorkersTTS(text: string): Promise<Response | null> {
  const token = process.env.CLOUDFLARE_WORKERS_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) return null;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/myshell-ai/melotts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: text.slice(0, 500) }),
    }
  );

  if (!res.ok) return null;

  // MeloTTS returns { result: { audio: "<base64 wav>" } }
  const json = await res.json() as { result?: { audio?: string } };
  const b64 = json.result?.audio;
  if (!b64) return null;

  const binary = Buffer.from(b64, 'base64');
  return new Response(binary, { headers: { 'Content-Type': 'audio/wav' } });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text } = await req.json() as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const clean = stripMarkdown(text);

  // 1. Try ElevenLabs
  const el = await elevenLabsTTS(clean).catch(() => null);
  if (el) {
    return new Response(el.body, {
      headers: {
        'Content-Type': el.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 2. Try Cloudflare Workers AI TTS
  const cf = await cloudflareWorkersTTS(clean).catch(() => null);
  if (cf) {
    return new Response(cf.body, {
      headers: {
        'Content-Type': cf.headers.get('Content-Type') || 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 3. Neither available — client falls back to Web Speech API
  return NextResponse.json({ fallback: true }, { status: 200 });
}
