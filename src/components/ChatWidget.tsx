'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Something on seerah for a 10-year-old',
  'What is your return policy?',
  'How long does shipping take?',
  'Where is my order?',
];

const GREETING =
  "Assalamu alaikum! I can help you find books, check prices and stock, and answer questions about shipping, returns and payment.";

// Renders **bold**, *italic*, [text](/path) links (internal paths and mailto only) and "- " bullets.
// Parsing is recursive so links inside bold/italic (e.g. **[Title](/books/1)**) still work.
const INLINE_TOKEN = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE_TOKEN).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith('/') && !href.startsWith('//')) {
        return (
          <Link key={key} href={href} className="text-emerald-700 underline font-medium">
            {label}
          </Link>
        );
      }
      if (href.startsWith('mailto:')) {
        return (
          <a key={key} href={href} className="text-emerald-700 underline font-medium">
            {label}
          </a>
        );
      }
      return <span key={key}>{label}</span>;
    }
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={key}>{renderInline(bold[1], key)}</strong>;
    const italic = part.match(/^\*([^*]+)\*$/);
    if (italic) return <em key={key}>{renderInline(italic[1], key)}</em>;
    return <span key={key}>{part}</span>;
  });
}

function MessageText({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{renderInline(bullet[1], `l${i}`)}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(line, `l${i}`)}</p>;
      })}
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    const setReply = (reply: string) =>
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: reply }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        setReply(err?.error || 'Sorry, something went wrong. Please try again.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setReply(reply);
      }
      if (!reply.trim()) setReply('Sorry, I could not come up with an answer. Please try again.');
    } catch {
      setReply('Sorry, I could not connect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chat assistant"
          data-testid="chat-open"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-white shadow-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-9 6l2.5-3H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z" />
          </svg>
          <span className="text-sm font-semibold">Ask us</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Bookstore assistant"
          data-testid="chat-panel"
          className="fixed bottom-0 right-0 z-[60] flex h-[85vh] w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl sm:bottom-4 sm:right-4 sm:h-[560px] sm:w-[380px] sm:rounded-2xl"
        >
          <div className="flex items-center justify-between bg-emerald-600 px-4 py-3 text-white">
            <div>
              <div className="font-semibold">Baytul Iqra Assistant</div>
              <div className="text-xs text-emerald-100">AI assistant · may make mistakes</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" data-testid="chat-close" className="rounded p-1 hover:bg-emerald-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-3 text-sm text-gray-900" aria-live="polite">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">{GREETING}</div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-left text-xs text-emerald-800 hover:bg-emerald-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-600 px-3 py-2 text-white">
                  {m.content}
                </div>
              ) : (
                <div key={i} data-testid="chat-reply" className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                  {m.content ? <MessageText text={m.content} /> : <span className="text-gray-400">Thinking…</span>}
                </div>
              )
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-gray-200 bg-white p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Ask about books, shipping, returns…"
              data-testid="chat-input"
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              data-testid="chat-send"
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
