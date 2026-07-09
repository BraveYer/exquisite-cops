'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Loader2 } from 'lucide-react';
import TierBadge from '../../components/TierBadge';
import { SEASON_REWARDS } from '../../lib/seasonRewards';
import PageBackground from '../../components/PageBackground';

type Standing = { rank: number; accountId: number | null; copsName: string; elo: number };
type Season = { number: number; name: string; status: string; startedAt?: string; endedAt?: string; finalStandings?: Standing[] };
type LbRow = { accountId?: number; copsName?: string; elo?: number };

function fmtDate(s?: string) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString(); } catch { return ''; }
}

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

export default function SeasonPage() {
  const [active, setActive] = useState<Season | null>(null);
  const [past, setPast] = useState<Season[]>([]);
  const [top, setTop] = useState<LbRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/season')
      .then(r => (r.ok ? r.json() : { active: null, past: [] }))
      .then(d => { setActive(d.active ?? null); setPast(d.past ?? []); setLoading(false); })
      .catch(() => setLoading(false));
    fetch('/api/leaderboard')
      .then(r => (r.ok ? r.json() : { players: [] }))
      .then(d => setTop(Array.isArray(d?.players) ? d.players.slice(0, 3) : []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />

      <div className="relative mx-auto max-w-3xl px-6 py-10 md:py-16">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 font-bold text-gray-400 transition-colors hover:text-cyan-400">
          <ArrowLeft size={20} /> BACK TO HUB
        </Link>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-24 text-cyan-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="font-bold uppercase tracking-widest">Loading…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-10 text-center">
              <Trophy className="mx-auto mb-3 text-cyan-400" size={32} />
              <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent">
                {active ? active.name : 'Seasons'}
              </h1>
              {active ? (
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-emerald-400">
                  Live · started {fmtDate(active.startedAt)}
                </p>
              ) : (
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-gray-500">No active season right now</p>
              )}
            </div>

            {/* Prize pool */}
            <div className="mb-8 rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/[0.07] to-transparent p-8 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Prize pool</p>
              <p className="my-1 bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-6xl font-black tracking-tighter text-transparent">
                {SEASON_REWARDS.prizePool}
              </p>
              {SEASON_REWARDS.note ? <p className="text-sm text-gray-400">{SEASON_REWARDS.note}</p> : null}
            </div>

            {/* Rewards */}
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Rewards</h2>
            <div className="mb-10 space-y-2">
              {SEASON_REWARDS.tiers.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">
                  <span className="flex items-center gap-3 font-black text-white">
                    <span className="text-xl">{t.medal}</span> {t.place}
                  </span>
                  <span className="text-sm font-bold text-cyan-300">{t.reward}</span>
                </div>
              ))}
            </div>

            {/* Live standings */}
            {top.length > 0 && (
              <>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Current standings</h2>
                <div className="mb-3 space-y-2">
                  {top.map((p, i) => {
                    const inner = (
                      <>
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="w-6 text-center text-lg">{medal(i + 1)}</span>
                          <TierBadge elo={p.elo ?? 1000} px={22} />
                          <span className="truncate font-bold text-white">{p.copsName || 'Unknown'}</span>
                        </span>
                        <span className="font-black text-cyan-400">{p.elo ?? 1000}</span>
                      </>
                    );
                    return p.accountId != null ? (
                      <Link key={i} href={`/profile/${p.accountId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 transition-colors hover:bg-white/[0.06]">
                        {inner}
                      </Link>
                    ) : (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">{inner}</div>
                    );
                  })}
                </div>
                <Link href="/leaderboard" className="mb-10 inline-block text-sm font-bold text-cyan-400 transition-colors hover:text-cyan-300">
                  View full leaderboard →
                </Link>
              </>
            )}

            {/* Past seasons */}
            {past.length > 0 && (
              <>
                <h2 className="mb-3 mt-2 text-sm font-bold uppercase tracking-widest text-gray-400">Past seasons</h2>
                <div className="space-y-4">
                  {past.map(s => (
                    <div key={s.number} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="mb-3 flex items-baseline justify-between">
                        <p className="font-black text-white">{s.name}</p>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">ended {fmtDate(s.endedAt)}</p>
                      </div>
                      <div className="space-y-1.5">
                        {(s.finalStandings || []).slice(0, 3).map(w => {
                          const row = (
                            <>
                              <span className="flex items-center gap-2">
                                <span className="w-6 text-center">{medal(w.rank)}</span>
                                <span className="font-bold text-white">{w.copsName}</span>
                              </span>
                              <span className="text-sm font-bold text-gray-400">{w.elo}</span>
                            </>
                          );
                          return w.accountId != null ? (
                            <Link key={w.rank} href={`/profile/${w.accountId}`} className="flex items-center justify-between rounded-xl px-2 py-1 transition-colors hover:bg-white/5">{row}</Link>
                          ) : (
                            <div key={w.rank} className="flex items-center justify-between px-2 py-1">{row}</div>
                          );
                        })}
                        {(!s.finalStandings || s.finalStandings.length === 0) && (
                          <p className="text-sm text-gray-600">No standings recorded.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
