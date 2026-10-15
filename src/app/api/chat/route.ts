import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/chat/systemPrompt';
import { CHAT_TOOLS, runChatTool } from '@/lib/chat/tools';
import { isRateLimited } from '@/lib/chat/rateLimit';

export const maxDuration = 30;

const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 1000;
const MAX_TOOL_ROUNDS = 4;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function parseMessages(body: unknown): ChatMessage[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const messages: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
    const content = m.content.trim().slice(0, MAX_CONTENT_LENGTH);
    if (!content) return null;
    messages.push({ role: m.role, content });
  }
  // Must start with and end on a user turn.
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return null;
  return messages;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Chat is not available right now.' }, { status: 503 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many messages. Please wait a minute and try again.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const history = parseMessages(body);
  if (!history) return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const response = client.messages.stream({
            model: MODEL,
            max_tokens: 700,
            system: SYSTEM_PROMPT,
            tools: CHAT_TOOLS,
            messages,
          });
          response.on('text', (text) => controller.enqueue(encoder.encode(text)));
          const final = await response.finalMessage();

          if (final.stop_reason !== 'tool_use') break;
          if (round === MAX_TOOL_ROUNDS) {
            controller.enqueue(encoder.encode('\n\nSorry, I could not finish that. Please try rephrasing your question.'));
            break;
          }

          messages.push({ role: 'assistant', content: final.content });
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const block of final.content) {
            if (block.type === 'tool_use') {
              results.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: await runChatTool(block.name, (block.input ?? {}) as Record<string, unknown>),
              });
            }
          }
          messages.push({ role: 'user', content: results });
        }
      } catch (error) {
        console.error('Chat error:', error);
        controller.enqueue(
          encoder.encode('\n\nSorry, something went wrong. Please try again, or contact us at sales@baytuliqra.com.')
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
