'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Loader2, MessagesSquare, Megaphone } from 'lucide-react';
import { getTier } from '../lib/tiers';
import { CosmeticStyles, nameClass, frameClass } from './ProfileCosmetics';
import { useReactions, ReactionBar } from './Reactions';
import { MessageText } from './MessageText';

type Msg = {
  id: string;
  fromMe: boolean;
  fromName: string;
  fromAccountId: number | null;
  fromAvatar: string | null;
  fromElo: number;
  text: string;
  createdAt: string | null;
};

function timeShort(s?: string | null) {
  if (!s) return '';
  const diff = Math.max(0, Date.now() - new Date(s).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ src, name, elo, size = 26, frame = '' }: { src: string | null; name: string; elo: number; size?: number; frame?: string }) {
  const color = getTier(elo).color;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`rounded-full object-cover ${frame}`} style={{ width: size, height: size, ...(frame ? {} : { boxShadow: `0 0 0 2px ${color}55` }) }} />;
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-black ${frame}`} style={{ width: size, height: size, color }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export default function ClubChat({ clubId, image, announce }: { clubId: string; image?: string | null; announce?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const knownStyleRef = useRef<Set<string>>(new Set());
  const [nameStyles, setNameStyles] = useState<Record<string, string | null>>({});
  const [nameFrames, setNameFrames] = useState<Record<string, string | null>>({});
  const ensureStyles = useCallback(async (ids: (number | null | undefined)[]) => {
    const need = Array.from(new Set(ids.filter((x): x is number => typeof x === 'number'))).map(String).filter((k) => !knownStyleRef.current.has(k));
    if (need.length === 0) return;
    need.forEach((k) => knownStyleRef.current.add(k));
    try {
      const r = await fetch(`/api/economy?names=${need.join(',')}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : { styles: {}, frames: {} };
      setNameStyles((prev) => ({ ...prev, ...(d.styles || {}) }));
      setNameFrames((prev) => ({ ...prev, ...(d.frames || {}) }));
    } catch {
      need.forEach((k) => knownStyleRef.current.delete(k));
    }
  }, []);
  const styleOf = (accId: number | null | undefined) => nameClass(nameStyles[String(accId)]);
  const { track: trackReactions, reactionsOf, toggle: toggleReaction } = useReactions('club');
  const frameOf = (accId: number | null | undefined) => frameClass(nameFrames[String(accId)]);

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    try {
      const r = await fetch(`/api/clans?chat=${clubId}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setMessages(d.messages || []);
      ensureStyles((d.messages || []).map((m: any) => m.fromAccountId));
      trackReactions((d.messages || []).map((m: any) => m.id));
    } catch {
      /* ignore */
    } finally {
      if (spinner) setLoading(false);
    }
  }, [clubId, ensureStyles]);

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(), 3500);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (atBottomRef.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    atBottomRef.current = true;
    setMessages((m) => [
      ...m,
      { id: 'tmp' + Date.now(), fromMe: true, fromName: 'You', fromAccountId: null, fromAvatar: image ?? null, fromElo: 1000, text: t, createdAt: new Date().toISOString() },
    ]);
    try {
      const r = await fetch('/api/clans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'chat', clubId, text: t }) });
      if (r.ok) load();
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-6">
      <CosmeticStyles />
      <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
        <MessagesSquare size={15} className="text-violet-300" /> Club chat
      </h2>
      <div className="flex h-[26rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {announce ? (
          <div className="flex items-start gap-2 border-b border-amber-400/20 bg-amber-500/[0.06] px-4 py-2.5 text-sm text-amber-100">
            <Megaphone size={14} className="mt-0.5 shrink-0 text-amber-400" />
            <p className="whitespace-pre-wrap break-words">{announce}</p>
          </div>
        ) : null}
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {loading && messages.length === 0 ? (
            <div className="flex justify-center py-16 text-cyan-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center text-xs font-bold uppercase tracking-widest text-gray-600">No messages yet — say hello</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                {!m.fromMe && <Avatar src={m.fromAvatar} name={m.fromName} elo={m.fromElo} size={26} frame={frameOf(m.fromAccountId)} />}
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${m.fromMe ? 'rounded-br-sm bg-cyan-500 text-black' : 'rounded-bl-sm bg-white/[0.07] text-gray-100'}`}>
                  {!m.fromMe && (
                    <p className={`mb-0.5 text-[11px] font-bold ${styleOf(m.fromAccountId)}`} style={styleOf(m.fromAccountId) ? undefined : { color: getTier(m.fromElo).color }}>
                      {m.fromName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words"><MessageText text={m.text} /></p>
                  {!String(m.id).startsWith('tmp') && (
                    <ReactionBar messageId={m.id} reactions={reactionsOf(m.id)} onToggle={toggleReaction} align={m.fromMe ? 'right' : 'left'} />
                  )}
                  <div className={`mt-0.5 text-[10px] ${m.fromMe ? 'text-black/50' : 'text-gray-500'}`}>{timeShort(m.createdAt)}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Message your club…"
              className="max-h-32 flex-1 resize-none bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
