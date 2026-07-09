'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

type RMap = Record<string, Record<string, { count: number; mine: boolean }>>;

export function useReactions(scope: string, pollMs = 15000) {
  const idsRef = useRef<Set<string>>(new Set());
  const [map, setMap] = useState<RMap>({});

  const fetchNow = useCallback(async () => {
    const ids = Array.from(idsRef.current);
    if (ids.length === 0) return;
    try {
      const r = await fetch(`/api/reactions?scope=${scope}&ids=${ids.join(',')}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : { reactions: {} };
      setMap(d.reactions || {});
    } catch {
      /* ignore */
    }
  }, [scope]);

  const track = useCallback(
    (newIds: (string | number | null | undefined)[]) => {
      let added = false;
      for (const id of newIds) {
        const s = id == null ? '' : String(id);
        if (s && !idsRef.current.has(s)) { idsRef.current.add(s); added = true; }
      }
      if (added) fetchNow();
    },
    [fetchNow]
  );

  useEffect(() => {
    const iv = setInterval(fetchNow, pollMs);
    return () => clearInterval(iv);
  }, [fetchNow, pollMs]);

  const toggle = useCallback(
    async (messageId: string, emoji: string) => {
      setMap((prev) => {
        const msg = { ...(prev[messageId] || {}) };
        const cur = msg[emoji] || { count: 0, mine: false };
        const mine = !cur.mine;
        const count = Math.max(0, cur.count + (mine ? 1 : -1));
        if (count === 0) delete msg[emoji];
        else msg[emoji] = { count, mine };
        return { ...prev, [messageId]: msg };
      });
      try {
        await fetch('/api/reactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, messageId, emoji }) });
      } catch {
        /* ignore */
      }
    },
    [scope]
  );

  const reactionsOf = (messageId: string | number) => map[String(messageId)] || {};
  return { track, reactionsOf, toggle };
}

export function ReactionBar({
  messageId,
  reactions,
  onToggle,
  align = 'left',
}: {
  messageId: string | number;
  reactions: Record<string, { count: number; mine: boolean }>;
  onToggle: (id: string, emoji: string) => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(reactions);
  const mid = String(messageId);

  return (
    <div className={`mt-1 flex flex-wrap items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
      {entries.map(([emoji, r]) => (
        <button
          key={emoji}
          onClick={() => onToggle(mid, emoji)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${r.mine ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]'}`}
        >
          <span>{emoji}</span>
          <span className="font-bold">{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-gray-500 opacity-70 transition-colors hover:bg-white/[0.08] hover:opacity-100"
          title="Add reaction"
        >
          <SmilePlus size={13} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className={`absolute bottom-full z-20 mb-1 flex gap-1 rounded-full border border-white/10 bg-[#0c0c12] px-2 py-1 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
              {REACTION_EMOJIS.map((e) => (
                <button key={e} onClick={() => { onToggle(mid, e); setOpen(false); }} className="text-lg leading-none transition-transform hover:scale-125">
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
