/**
 * Cloudflare Workers AI integration.
 *
 * Required token permissions:
 *   - Workers AI: Read   (for inference)
 *
 * If your main CLOUDFLARE_API_TOKEN lacks Workers AI access, set a
 * separate CLOUDFLARE_WORKERS_AI_TOKEN in .env.local.
 */

function getWorkerAIToken(): string {
  const token =
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN;

  if (!token || token === 'your_api_token_here') {
    throw new Error(
      'Workers AI is not configured. Add CLOUDFLARE_WORKERS_AI_TOKEN to .env.local ' +
      'with a token that has "Workers AI: Read" permission. ' +
      'Create one at https://dash.cloudflare.com/profile/api-tokens'
    );
  }
  return token;
}

function aiBase(): string {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId || accountId === 'your_account_id_here') {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is not set in .env.local');
  }
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

const SYSTEM_PROMPT = `You are EduBot, an AI teaching assistant embedded in a live virtual classroom. Your role:
- Answer student questions clearly and concisely
- Explain concepts with examples and analogies
- Keep responses educational but conversational
- Use markdown for code blocks (wrap in triple backticks) and short lists
- If genuinely unsure, say so and suggest asking the instructor
- When students ask via voice, keep responses shorter (2–4 sentences max)

Current session context will be provided when available.`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Build the messages array for a chat request — exported for streaming route and tests */
export function buildAIMessages(
  question: string,
  context?: {
    sessionTitle?: string;
    recentTranscript?: string;
    conversationHistory?: ChatMessage[];
    voiceMode?: boolean;
  }
): ChatMessage[] {
  let systemContent = SYSTEM_PROMPT;
  if (context?.sessionTitle) systemContent += `\n\nCurrent class: "${context.sessionTitle}"`;
  if (context?.recentTranscript) systemContent += `\n\nRecent class discussion:\n${context.recentTranscript}`;
  if (context?.voiceMode) systemContent += '\n\nIMPORTANT: The student asked via voice. Keep your answer to 2–3 sentences max.';

  return [
    { role: 'system', content: systemContent },
    ...(context?.conversationHistory ?? []).slice(-6),
    { role: 'user', content: question },
  ];
}

export async function askAI(
  question: string,
  context?: {
    sessionTitle?: string;
    recentTranscript?: string;
    conversationHistory?: ChatMessage[];
    voiceMode?: boolean;
  }
): Promise<string> {
  const token = getWorkerAIToken();
  const base = aiBase();

  const messages = buildAIMessages(question, context);

  const res = await fetch(`${base}/${MODEL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Workers AI token is invalid or missing "Workers AI: Read" permission. ' +
        'Add CLOUDFLARE_WORKERS_AI_TOKEN to .env.local.'
      );
    }
    throw new Error(`Workers AI error (${res.status}): ${body}`);
  }

  const data = await res.json() as { result?: { response?: string }; errors?: unknown[] };

  if (!data.result?.response) {
    throw new Error(`Unexpected Workers AI response: ${JSON.stringify(data)}`);
  }

  return data.result.response;
}

export async function generateSessionSummary(transcript: string, sessionTitle: string): Promise<string> {
  const token = getWorkerAIToken();
  const base = aiBase();

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an expert at summarizing educational sessions. Create comprehensive, well-structured markdown summaries.',
    },
    {
      role: 'user',
      content: `Summarize this class session: "${sessionTitle}"\n\nTranscript:\n${transcript}\n\nFormat:\n## Key Topics Covered\n## Main Concepts\n## Questions & Answers\n## Action Items / Homework\n## Next Steps`,
    },
  ];

  const res = await fetch(`${base}/${MODEL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to generate summary (${res.status}): ${body}`);
  }

  const data = await res.json() as { result?: { response?: string } };
  return data.result?.response ?? 'Summary unavailable.';
}
