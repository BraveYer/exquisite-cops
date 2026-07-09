'use client';

import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, Check, Swords } from 'lucide-react';

type P = { discordId: string; copsName: string; team: 'A' | 'B'; stats: { k: number; d: number; a: number } | null };
type M = { matchId: string; map: string; status: string; winner: string | null; createdAt: string | null; hasStats: boolean; players: P[] };

export default function AdminMatchStats() {
  const [matches, setMatches] = useState<M[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { k: string; d: string; a: string }>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/matches')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setMatches(d.matches || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openMatch = (m: M) => {
    if (openId === m.matchId) { setOpenId(null); return; }
    const d: Record<string, { k: string; d: string; a: string }> = {};
    for (const p of m.players) d[p.discordId] = { k: String(p.stats?.k ?? ''), d: String(p.stats?.d ?? ''), a: String(p.stats?.a ?? '') };
    setDraft(d);
    setOpenId(m.matchId);
    setMsg('');
  };

  const setField = (did: string, f: 'k' | 'd' | 'a', v: string) => setDraft((prev) => ({ ...prev, [did]: { ...prev[did], [f]: v } }));

  const saveAll = async (m: M) => {
    setBusy(true);
    setMsg('');
    try {
      const stats = m.players.map((p) => ({ discordId: p.discordId, k: Number(draft[p.discordId]?.k) || 0, d: Number(draft[p.discordId]?.d) || 0, a: Number(draft[p.discordId]?.a) || 0 }));
      const r = await fetch(`/api/match/${m.matchId}/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stats }) });
      if (r.ok) { setMsg('Saved!'); load(); }
      else { const d = await r.json().catch(() => ({})); setMsg(d?.error || 'Failed.'); }
    } catch {
      setMsg('Failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
        <Swords size={16} /> Match stats (K/D)
      </h2>
      {loading ? (
        <div className="flex justify-center py-10 text-cyan-400"><Loader2 className="animate-spin" size={22} /></div>
      ) : matches.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center text-sm text-gray-600">No matches yet.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => {
            const open = openId === m.matchId;
            const stColor = m.status === 'completed' ? '#34d399' : m.status === 'disputed' ? '#f87171' : '#22d3ee';
            return (
              <div key={m.matchId} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <button onClick={() => openMatch(m)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]">
                  <span className="font-mono text-xs text-gray-500">#{m.matchId}</span>
                  <span className="text-sm font-bold text-white">{m.map || '—'}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ color: stColor, backgroundColor: `${stColor}1f` }}>{m.status}</span>
                  {m.hasStats && <Check size={13} className="text-emerald-400" />}
                  <span className="ml-auto text-[11px] text-gray-600">{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ''}</span>
                  <ChevronDown size={15} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="border-t border-white/10 p-3">
                    <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-widest text-gray-600">
                      <span className="flex-1">Player</span>
                      <span className="w-14 text-center">K</span>
                      <span className="w-14 text-center">D</span>
                      <span className="w-14 text-center">A</span>
                    </div>
                    <div className="space-y-1.5">
                      {m.players.map((p) => (
                        <div key={p.discordId} className="flex items-center gap-2">
                          <span className={`w-4 shrink-0 text-center text-[10px] font-black ${p.team === 'A' ? 'text-cyan-400' : 'text-fuchsia-400'}`}>{p.team}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{p.copsName}</span>
                          {(['k', 'd', 'a'] as const).map((f) => (
                            <input
                              key={f}
                              type="number"
                              min={0}
                              value={draft[p.discordId]?.[f] ?? ''}
                              onChange={(e) => setField(p.discordId, f, e.target.value)}
                              className="w-14 rounded-lg border border-white/10 bg-[#08080c] px-2 py-1.5 text-center text-sm font-bold text-white focus:border-cyan-500/50 focus:outline-none"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-3">
                      {msg ? <span className="text-xs font-bold text-cyan-300">{msg}</span> : null}
                      <button onClick={() => saveAll(m)} disabled={busy} className="rounded-full bg-cyan-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save all'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
