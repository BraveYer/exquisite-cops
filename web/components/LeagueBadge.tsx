'use client';

import { useEffect, useState } from 'react';
import { Trophy, Eye } from 'lucide-react';

export default function LeagueBadge({ matchId }: { matchId: string }) {
  const [st, setSt] = useState<{ proLeague: boolean; canToggle: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/match/${matchId}/league`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setSt(d); })
      .catch(() => {});

  useEffect(() => { load(); }, [matchId]);

  if (!st || (!st.proLeague && !st.canToggle)) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/match/${matchId}/league`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setSt((s) => (s ? { ...s, proLeague: !!d.proLeague } : s));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${st.proLeague ? 'border-cyan-500/30 bg-gradient-to-r from-cyan-500/[0.1] to-transparent' : 'border-white/10 bg-white/[0.03]'}`}>
      {st.proLeague ? (
        <span className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-cyan-300">
          <Trophy size={16} /> Exquisite Pro League
          <span className="flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-200"><Eye size={11} /> Spectatable</span>
        </span>
      ) : (
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Not a Pro League match</span>
      )}
      {st.canToggle && (
        <button
          onClick={toggle}
          disabled={busy}
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${st.proLeague ? 'border border-white/10 bg-white/5 text-gray-300 hover:text-white' : 'bg-cyan-500 text-black hover:bg-cyan-400'}`}
        >
          {st.proLeague ? 'Remove from league' : 'Add to Pro League'}
        </button>
      )}
    </div>
  );
}
