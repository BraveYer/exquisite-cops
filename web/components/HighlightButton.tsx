'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

export default function HighlightButton({ matchId }: { matchId: string }) {
  const [state, setState] = useState<{ isHighlight: boolean; eligible: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/match/${matchId}/highlight`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setState(d); })
      .catch(() => {});

  useEffect(() => { load(); }, [matchId]);

  if (!state || !state.eligible) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/match/${matchId}/highlight`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setState((s) => (s ? { ...s, isHighlight: !!d.isHighlight } : s));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="flex items-center gap-3">
        <Star size={20} className={state.isHighlight ? 'fill-amber-400 text-amber-400' : 'text-gray-500'} />
        <div>
          <p className="text-sm font-black text-white">Highlight match</p>
          <p className="text-xs text-gray-500">{state.isHighlight ? 'Pinned to your profile' : 'Pin this match to the top of your profile'}</p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
          state.isHighlight ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-amber-500 text-black hover:bg-amber-400'
        }`}
      >
        {state.isHighlight ? 'Remove' : 'Pin as highlight'}
      </button>
    </div>
  );
}
