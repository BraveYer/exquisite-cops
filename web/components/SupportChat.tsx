'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

const GREETING =
  "Hey! I'm the COPS Assistant 🎮 Ask me anything about matchmaking, ranks, the draft, map veto, reporting, or seasons.";

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      // Drop the client-side greeting before sending (the API needs a user-first thread).
      const payload = next.filter((m) => !(m.role === 'assistant' && m.content === GREETING));
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      const d = await res.json().catch(() => ({}));
      setMessages((m) => [...m, { role: 'assistant', content: d?.reply || "Sorry, I'm having trouble. Try asking staff on Discord." }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: "Sorry, I'm having trouble. Try asking staff on Discord." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          className="group fixed bottom-5 left-5 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500 text-black shadow-[0_0_30px_-4px_rgba(34,211,238,0.7)] transition-transform hover:scale-105 md:left-[16rem]"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 left-5 z-[55] flex h-[30rem] max-h-[calc(100vh-3rem)] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0f]/[0.98] shadow-2xl backdrop-blur md:left-[16rem]">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-sm font-black leading-tight text-white">COPS Assistant</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500">AI support</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-500 transition-colors hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === 'user' ? 'bg-cyan-500 font-medium text-black' : 'border border-white/10 bg-white/[0.04] text-gray-200'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
                placeholder="Ask about the hub…"
                className="flex-1 rounded-full border border-white/10 bg-[#101015] px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
              />
              <button
                onClick={send}
                disabled={!input.trim() || busy}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-gray-600">AI assistant — may be wrong. For bans or disputes, contact staff on Discord.</p>
          </div>
        </div>
      )}
    </>
  );
}
