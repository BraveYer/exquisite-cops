'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Send } from 'lucide-react';
import { getTier } from '../lib/tiers';
import { CosmeticStyles, useNameStyles } from './ProfileCosmetics';
import { useReactions, ReactionBar } from './Reactions';
import { MessageText } from './MessageText';

type Msg = {
  id: string;
  authorName: string;
  authorAccountId: number | null;
  authorAvatar: string | null;
  authorElo: number;
  text: string;
  createdAt: string | null;
};

export default function ChatBox({
  scope,
  title = 'Chat',
  heightClass = 'h-80',
}: {
  scope: string;
  title?: string;
  heightClass?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [state, setState] = useState<'loading' | 'ok' | 'unauth' | 'forbidden' | 'error'>('loading');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const { ensure, styleOf, frameOf } = useNameStyles();
  const { track: trackReactions, reactionsOf, toggle: toggleReaction } = useReactions('lobby');

  const load = async () => {
    try {
      const r = await fetch(`/api/chat?scope=${encodeURIComponent(scope)}`);
      if (r.status === 401) return setState('unauth');
      if (r.status === 403) return setState('forbidden');
      if (!r.ok) return setState('error');
      const d = await r.json();
      setMessages(d.messages || []);
      ensure((d.messages || []).map((m: any) => m.authorAccountId));
      trackReactions((d.messages || []).map((m: any) => m.id));
      setState('ok');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 3500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    if (atBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, text: t }),
      });
      if (r.ok) {
        const d = await r.json();
        setText('');
        atBottomRef.current = true;
        if (d.message) setMessages(prev => [...prev, d.message]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
      <CosmeticStyles />
      <div className="border-b border-white/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-gray-400">
        {title}
      </div>

      <div ref={scrollRef} onScroll={onScroll} className={`${heightClass} space-y-3 overflow-y-auto px-5 py-4`}>
        {state === 'loading' && <p className="text-center text-sm text-gray-600">Loading…</p>}
        {state === 'unauth' && (
          <p className="py-8 text-center text-sm font-bold uppercase tracking-widest text-gray-600">Log in to chat.</p>
        )}
        {state === 'forbidden' && (
          <p className="py-8 text-center text-sm font-bold uppercase tracking-widest text-gray-600">
            This chat is for match players only.
          </p>
        )}
        {state === 'error' && <p className="py-8 text-center text-sm text-gray-600">Couldn&apos;t load chat.</p>}
        {state === 'ok' && messages.length === 0 && (
          <p className="py-8 text-center text-sm font-bold uppercase tracking-widest text-gray-600">No messages yet.</p>
        )}

        {state === 'ok' &&
          messages.map(m => (
            <div key={m.id} className="flex items-start gap-2.5">
              <span className={`mt-0.5 block h-7 w-7 shrink-0 overflow-hidden rounded-full ${frameOf(m.authorAccountId) || 'ring-1 ring-white/10'}`}>
                {m.authorAvatar ? (
                  <img src={m.authorAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-white/10 text-[10px] font-black text-white">
                    {(m.authorName || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                {m.authorAccountId != null ? (
                  <Link
                    href={`/profile/${m.authorAccountId}`}
                    className={`text-sm font-bold hover:underline ${styleOf(m.authorAccountId)}`}
                    style={styleOf(m.authorAccountId) ? undefined : { color: getTier(m.authorElo).color }}
                  >
                    {m.authorName}
                  </Link>
                ) : (
                  <span className={`text-sm font-bold ${styleOf(m.authorAccountId)}`} style={styleOf(m.authorAccountId) ? undefined : { color: getTier(m.authorElo).color }}>
                    {m.authorName}
                  </span>
                )}
                <p className="break-words text-sm text-gray-200"><MessageText text={m.text} /></p>
                <ReactionBar messageId={m.id} reactions={reactionsOf(m.id)} onToggle={toggleReaction} />
              </div>
            </div>
          ))}
      </div>

      {state === 'ok' && (
        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
            maxLength={500}
            placeholder="Message…"
            className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/60"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 text-black transition-colors hover:bg-cyan-300 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
