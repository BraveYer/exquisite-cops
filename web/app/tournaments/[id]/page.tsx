'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trophy, Loader2, ArrowLeft, Users, Gift, Crown, Play, Trash2, Check, LogIn } from 'lucide-react';
import { getTier } from '../../../lib/tiers';
import PageBackground from '../../../components/PageBackground';

type Ref = { accountId: number | null; copsName: string; avatar: string | null; elo: number } | null;
type Match = { id: string; a: Ref; b: Ref; winner: 'a' | 'b' | null };
type Tournament = {
  id: string;
  name: string;
  description: string;
  prize: string;
  size: number;
  status: 'open' | 'live' | 'completed';
  participants: NonNullable<Ref>[];
  bracket: Match[][] | null;
  champion: Ref;
  createdAt: string | null;
};

function Avatar({ src, name, elo, size = 26 }: { src: string | null; name: string; elo: number; size?: number }) {
  const color = getTier(elo).color;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="rounded-full object-cover" style={{ width: size, height: size, boxShadow: `0 0 0 2px ${color}55` }} />;
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-black" style={{ width: size, height: size, color }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function roundName(r: number, total: number) {
  const fromEnd = total - 1 - r;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinals';
  if (fromEnd === 2) return 'Quarterfinals';
  return `Round ${r + 1}`;
}

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [t, setT] = useState<Tournament | null>(null);
  const [amOrganizer, setAmOrganizer] = useState(false);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/tournaments?id=${id}`, { cache: 'no-store' });
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      const d = r.ok ? await r.json() : null;
      if (d?.tournament) {
        setT(d.tournament);
        setAmOrganizer(!!d.amOrganizer);
        setJoined(!!d.joined);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [load]);

  const act = async (payload: any, opts: { navigateAway?: boolean } = {}) => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/tournaments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d?.error || 'Action failed.');
        return;
      }
      if (opts.navigateAway || d.deleted) {
        router.push('/tournaments');
        return;
      }
      await load();
    } catch {
      setErr('Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709] text-cyan-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (notFound || !t) {
    return (
      <div className="min-h-screen bg-[#070709] text-white">
        <PageBackground />
        <div className="relative mx-auto max-w-md px-6 py-24 text-center">
          <Trophy size={30} className="mx-auto mb-4 text-gray-600" />
          <h1 className="text-2xl font-black">Tournament not found</h1>
          <Link href="/tournaments" className="mt-4 inline-block text-sm font-bold text-cyan-400 hover:text-cyan-300">← Back to tournaments</Link>
        </div>
      </div>
    );
  }

  const total = t.bracket?.length || 0;
  const canPick = (m: Match) => amOrganizer && t.status === 'live' && !!m.a && !!m.b && !m.winner;

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <div className="relative mx-auto max-w-5xl px-6 py-8 md:py-12">
        <Link href="/tournaments" className="mb-5 inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-white">
          <ArrowLeft size={16} /> Tournaments
        </Link>

        {/* Champion banner */}
        {t.status === 'completed' && t.champion && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/[0.12] to-transparent px-5 py-4">
            <Crown size={26} className="text-yellow-400" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-yellow-500/80">Champion</p>
              <p className="text-xl font-black text-white">{t.champion.copsName}</p>
            </div>
            {t.prize ? <span className="ml-auto flex items-center gap-1.5 text-sm font-bold text-amber-300"><Gift size={15} /> {t.prize}</span> : null}
          </div>
        )}

        {/* Header */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight">{t.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-widest text-gray-500">
                <span className="flex items-center gap-1.5"><Users size={13} /> {t.participants.length}/{t.size}</span>
                <span>Single elimination</span>
                {t.prize ? <span className="flex items-center gap-1.5 normal-case text-amber-300"><Gift size={13} /> {t.prize}</span> : null}
              </div>
            </div>
            {t.status === 'live' ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live</span>
            ) : t.status === 'open' ? (
              <span className="rounded-full bg-cyan-500/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-300">Registration open</span>
            ) : (
              <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-gray-500">Ended</span>
            )}
          </div>

          {t.description ? <p className="mt-4 whitespace-pre-wrap text-sm text-gray-300">{t.description}</p> : null}
          {err ? <p className="mt-3 text-xs font-bold text-red-400">{err}</p> : null}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {t.status === 'open' && session && (
              joined ? (
                <button onClick={() => act({ action: 'leave' })} disabled={busy} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50">Leave</button>
              ) : (
                <button onClick={() => act({ action: 'join' })} disabled={busy || t.participants.length >= t.size} className="flex items-center gap-1.5 rounded-full bg-cyan-500 px-5 py-2 text-sm font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:opacity-50">
                  <LogIn size={14} /> {t.participants.length >= t.size ? 'Full' : 'Register'}
                </button>
              )
            )}
            {amOrganizer && t.status === 'open' && (
              <button onClick={() => { if (window.confirm('Start the tournament? Registration will close and the bracket will be generated.')) act({ action: 'start' }); }} disabled={busy || t.participants.length < 2} className="flex items-center gap-1.5 rounded-full bg-violet-500 px-5 py-2 text-sm font-black uppercase tracking-widest text-white hover:bg-violet-400 disabled:opacity-50">
                <Play size={14} /> Start
              </button>
            )}
            {amOrganizer && (
              <button onClick={() => { if (window.confirm('Delete this tournament?')) act({ action: 'delete' }, { navigateAway: true }); }} disabled={busy} className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Registration list (open) */}
        {t.status === 'open' && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-black uppercase tracking-widest text-gray-400">Registered ({t.participants.length})</h2>
            {t.participants.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-gray-600">No one registered yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {[...t.participants].sort((a, b) => b.elo - a.elo).map((p, i) => (
                  <div key={p.accountId ?? p.copsName} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="w-5 text-center text-xs font-black text-gray-600">{i + 1}</span>
                    <Avatar src={p.avatar} name={p.copsName} elo={p.elo} size={30} />
                    <Link href={`/profile/${p.accountId}`} className="min-w-0 flex-1 truncate text-sm font-bold text-white hover:text-cyan-400">{p.copsName}</Link>
                    <span className="text-xs font-bold" style={{ color: getTier(p.elo).color }}>{p.elo}</span>
                  </div>
                ))}
              </div>
            )}
            {amOrganizer && t.participants.length >= 2 && (
              <p className="mt-3 text-xs text-gray-500">Higher ELO players are seeded higher. Uneven counts get first-round byes.</p>
            )}
          </div>
        )}

        {/* Bracket (live / completed) */}
        {t.bracket && (t.status === 'live' || t.status === 'completed') && (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-gray-400">Bracket</h2>
            <div className="overflow-x-auto pb-2">
              <div className="flex min-h-[20rem] gap-5" style={{ minWidth: total * 210 }}>
                {t.bracket.map((round, r) => (
                  <div key={r} className="flex min-w-[190px] flex-1 flex-col">
                    <p className="mb-2 text-center text-[11px] font-black uppercase tracking-widest text-gray-600">{roundName(r, total)}</p>
                    <div className="flex flex-1 flex-col justify-around gap-3">
                      {round.map((m) => (
                        <div key={m.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                          {(['a', 'b'] as const).map((side) => {
                            const p = m[side];
                            const isWinner = m.winner === side;
                            const isLoser = m.winner && m.winner !== side;
                            const pickable = canPick(m);
                            const rowInner = (
                              <>
                                {p ? <Avatar src={p.avatar} name={p.copsName} elo={p.elo} size={22} /> : <span className="h-[22px] w-[22px] shrink-0 rounded-full bg-white/5" />}
                                <span className={`min-w-0 flex-1 truncate text-sm font-bold ${isWinner ? 'text-white' : isLoser ? 'text-gray-600 line-through' : p ? 'text-gray-200' : 'text-gray-600'}`}>
                                  {p ? p.copsName : m.a || m.b ? 'TBD' : '—'}
                                </span>
                                {isWinner && <Check size={14} className="shrink-0 text-emerald-400" />}
                              </>
                            );
                            return pickable ? (
                              <button
                                key={side}
                                onClick={() => act({ action: 'report', matchId: m.id, winner: side })}
                                disabled={busy}
                                title="Click the winner"
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-cyan-500/15 ${side === 'a' ? 'border-b border-white/10' : ''}`}
                              >
                                {rowInner}
                              </button>
                            ) : (
                              <div key={side} className={`flex items-center gap-2 px-3 py-2 ${side === 'a' ? 'border-b border-white/10' : ''} ${isWinner ? 'bg-emerald-500/[0.08]' : ''}`}>
                                {rowInner}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {amOrganizer && t.status === 'live' && <p className="mt-2 text-xs text-gray-500">Click the winner of each ready match to advance them.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
