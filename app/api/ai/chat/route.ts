import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { getSessionById } from '@/lib/db';
import { buildAIMessages } from '@/lib/ai';

const schema = z.object({
  session_id: z.string(),
  question: z.string().min(1).max(2000),
  recent_transcript: z.string().optional(),
  voice_mode: z.boolean().optional(),
  conversation_history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { session_id, question, recent_transcript, voice_mode, conversation_history } = parsed.data;

    const session = await getSessionById(session_id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const messages = buildAIMessages(question, {
      sessionTitle: session.title,
      recentTranscript: recent_transcript,
      voiceMode: voice_mode,
      conversationHistory: conversation_history as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    });

    const token = process.env.CLOUDFLARE_WORKERS_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!token || token === 'your_api_token_here' || !accountId) {
      return NextResponse.json({ error: 'Workers AI is not configured. Add CLOUDFLARE_WORKERS_AI_TOKEN to .env.local' }, { status: 500 });
    }

    const aiRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages, stream: true }),
      }
    );

    if (!aiRes.ok) {
      const err = await aiRes.text();
      const hint = aiRes.status === 401 || aiRes.status === 403
        ? ' — ensure your token has "Workers AI: Read" permission'
        : '';
      return NextResponse.json({ error: `Workers AI error (${aiRes.status})${hint}: ${err}` }, { status: 502 });
    }

    // Pipe the SSE stream directly to the client.
    // Workers AI sends: data: {"response":"token"}\n\ndata: [DONE]\n\n
    // We transform it to plain text chunks so the client can append them.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiRes.body!.getReader();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? ''; // keep incomplete line in buffer

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') { controller.close(); return; }
              try {
                const parsed = JSON.parse(data) as { response?: string };
                if (parsed.response) {
                  controller.enqueue(encoder.encode(parsed.response));
                }
              } catch {
                // skip malformed SSE lines
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get AI response';
    console.error('AI chat error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
