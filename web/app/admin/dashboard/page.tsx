'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldAlert, Users, Activity, Radio, Swords, Trophy, Medal, Shield, Coins, TrendingUp } from 'lucide-react';
import PageBackground from '../../../components/PageBackground';
import AdminMatchStats from '../../../components/AdminMatchStats';
import AdminUpdates from '../../../components/AdminUpdates';

type Stats = {
  players: { total: number; verified: number; active7: number; active30: number; searchingNow: number };
  matches: { total: number; today: number; week: number; perDay: { date: string; count: number }[] };
  retention?: { dauPerDay: { date: string; count: number }[]; wau: number; mau: number };
  tournaments: { total: number; active: number };
  clubs: { total: number };
  economy: { totalEp: number; wallets: number };
  topMaps: { map: string; count: number }[];
};

function StatCard({ icon: Icon, label, value, sub, color = '#22d3ee' }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-500">
        <Icon size={14} style={{ color }} /> {label}
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/admin/stats', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          setState('forbidden');
          return null;
        }
        if (!r.ok) {
          setState('error');
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) {
          setStats(d);
          setState('ok');
        }
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <div className="relative mx-auto max-w-4xl px-6 py-8 md:py-12">
        <Link href="/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-white">
          <ArrowLeft size={16} /> Admin
        </Link>

        <div className="mb-6">
          <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Analytics</div>
          <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">Dashboard</h1>
        </div>

        {state === 'loading' && (
          <div className="flex justify-center py-24 text-cyan-400"><Loader2 className="animate-spin" size={28} /></div>
        )}
        {state === 'forbidden' && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.06] px-6 py-16 text-center">
            <ShieldAlert size={28} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm font-bold text-red-300">Staff access only.</p>
          </div>
        )}
        {state === 'error' && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center text-sm text-gray-500">Could not load stats.</div>
        )}

        {state === 'ok' && stats && (
          <div className="space-y-6">
            {/* Players */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard icon={Users} label="Players" value={stats.players.total.toLocaleString()} sub={`${stats.players.verified} verified`} />
              <StatCard icon={Activity} label="Active 7d" value={stats.players.active7.toLocaleString()} sub={`${stats.players.active30} in 30d`} color="#34d399" />
              <StatCard icon={Radio} label="Searching now" value={stats.players.searchingNow} sub="in queue" color="#f472b6" />
              <StatCard icon={Swords} label="Matches today" value={stats.matches.today.toLocaleString()} color="#f59e0b" />
              <StatCard icon={TrendingUp} label="Matches 7d" value={stats.matches.week.toLocaleString()} color="#f59e0b" />
              <StatCard icon={Swords} label="Total matches" value={stats.matches.total.toLocaleString()} />
              <StatCard icon={Medal} label="Tournaments" value={stats.tournaments.active} sub={`${stats.tournaments.total} all-time`} color="#a78bfa" />
              <StatCard icon={Shield} label="Clubs" value={stats.clubs.total.toLocaleString()} color="#38bdf8" />
              <StatCard icon={Coins} label="EP in circulation" value={stats.economy.totalEp.toLocaleString()} sub={`${stats.economy.wallets} wallets`} color="#fcd34d" />
            </div>

            {/* Matches per day */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-400">Matches — last 14 days</h2>
              {(() => {
                const max = Math.max(1, ...stats.matches.perDay.map((d) => d.count));
                return (
                  <div className="flex h-40 items-end gap-1.5">
                    {stats.matches.perDay.map((d) => (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className="w-full rounded-t bg-gradient-to-t from-cyan-500/60 to-violet-500/60"
                            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                            title={`${d.count} matches`}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-600">{d.date}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Active players per day (DAU) */}
            {stats.retention && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Active players — last 14 days</h2>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="text-emerald-400">WAU {stats.retention.wau.toLocaleString()}</span>
                    <span className="text-violet-400">MAU {stats.retention.mau.toLocaleString()}</span>
                  </div>
                </div>
                {(() => {
                  const max = Math.max(1, ...stats.retention!.dauPerDay.map((d) => d.count));
                  return (
                    <div className="flex h-40 items-end gap-1.5">
                      {stats.retention!.dauPerDay.map((d) => (
                        <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                          <div className="flex w-full flex-1 items-end">
                            <div
                              className="w-full rounded-t bg-gradient-to-t from-emerald-500/60 to-cyan-500/60"
                              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                              title={`${d.count} active`}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-gray-600">{d.date}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <p className="mt-3 text-[11px] text-gray-600">DAU = distinct players who completed a match that day.</p>
              </div>
            )}

            {/* Top maps */}
            {stats.topMaps.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-400">Top maps — last 30 days</h2>
                <div className="space-y-2.5">
                  {(() => {
                    const max = Math.max(1, ...stats.topMaps.map((m) => m.count));
                    return stats.topMaps.map((m) => (
                      <div key={m.map} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-sm font-bold text-gray-300">{m.map}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(m.count / max) * 100}%` }} />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-black text-gray-400">{m.count}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <AdminUpdates />

            <AdminMatchStats />
          </div>
        )}
      </div>
    </div>
  );
}
