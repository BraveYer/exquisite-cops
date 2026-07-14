'use client';

import { useEffect, useState } from 'react';
import { ThumbsUp } from 'lucide-react';

type P = { discordId?: string; copsName?: string | null };

export default function CommendPanel({ matchId, myId, participants }: { matchId: string; myId?: string; participants: P[] }) {
  const [data, setData] = useState<{ types: Record<string, string>; mine: Record<string, string>; counts: Record<string, number>; eligible: boolean } | null>(null);
  const [busy, setBusy] = useState('');

  const load = () =>
    fetch(`/api/match/${matchId}/commend`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setData(d); })
      .catch(() => {});

  useEffect(() => { load(); }, [matchId]);

  if (!data) return null;
  const teammates = participants.filter((p) => p.discordId && p.discordId !== myId);
  if (teammates.length === 0) return null;

  const commend = async (toId: string, type: string) => {
    if (!data.eligible) return;
    setBusy(toId + type);
    try {
      await fetch(`/api/match/${matchId}/commend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toId, type }) });
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-4 flex items-center gap-2">
        <ThumbsUp size={18} className="text-emerald-400" />
        <h3 className="text-lg font-black text-white">Commends</h3>
      </div>
      {!data.eligible && <p className="mb-3 text-xs text-gray-500">Only players in this match can give commends.</p>}
      <div className="space-y-3">
        {teammates.map((p) => {
          const did = p.discordId as string;
          const myType = data.mine[did];
          const received = data.counts[did] || 0;
          return (
            <div key={did} className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-bold text-white">{p.copsName || 'Unknown'}</span>
                {received > 0 && <span className="text-[11px] font-black text-emerald-400">+{received}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.types).map(([key, label]) => {
                  const active = myType === key;
                  return (
                    <button
                      key={key}
                      disabled={!data.eligible || busy === did + key}
                      onClick={() => commend(did, key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${active ? 'bg-emerald-500 text-black' : 'border border-white/10 bg-white/5 text-gray-300 hover:text-white'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {data.eligible && <p className="mt-3 text-xs text-gray-500">Tap to commend a teammate — tap again to remove. One per teammate.</p>}
    </div>
  );
}
