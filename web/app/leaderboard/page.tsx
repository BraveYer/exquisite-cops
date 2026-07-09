'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Loader2 } from 'lucide-react';
import TierBadge from '../../components/TierBadge';
import PageBackground from '../../components/PageBackground';
import { CosmeticStyles, nameClass, frameClass } from '../../components/ProfileCosmetics';

type Row = {
  accountId?: number;
  copsName?: string;
  avatar?: string | null;
  elo?: number;
  wins?: number;
  losses?: number;
  gamesPlayed?: number;
  level?: number;
  form?: ('W' | 'L')[];
  club?: { id: string; tag: string; color?: string | null } | null;
  nameStyle?: string | null;
  frame?: string | null;
};

function ClubTag({ club, className = '' }: { club?: { id: string; tag: string; color?: string | null } | null; className?: string }) {
  if (!club) return null;
  const color = club.color || '#a78bfa';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-black leading-none ${className}`}
      style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
    >
      [{club.tag}]
    </span>
  );
}

const rankAccent = (i: number) => {
  if (i === 0) return 'text-yellow-400';
  if (i === 1) return 'text-gray-300';
  if (i === 2) return 'text-amber-600';
  return 'text-gray-500';
};

function PodiumCard({ row, place }: { row: Row; place: number }) {
  const ring = place === 1 ? '#facc15' : place === 2 ? '#cbd5e1' : '#d97706';
  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
  const cardW = place === 1 ? 'w-28 sm:w-44' : 'w-24 sm:w-36';
  const avSize = place === 1 ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-12 w-12 sm:h-16 sm:w-16';
  const lift = place === 1 ? '' : 'mt-8';

  const content = (
    <div className={`${cardW} ${lift} flex flex-col items-center rounded-3xl border border-white/10 bg-white/[0.03] px-3 py-5 text-center backdrop-blur-sm`}>
      <div className="relative mb-3">
        <span className={`block ${avSize} overflow-hidden rounded-full ${frameClass(row.frame)}`} style={row.frame ? undefined : { boxShadow: `0 0 0 3px ${ring}` }}>
          {row.avatar ? (
            <img src={row.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-white/10 text-lg font-black text-white">
              {(row.copsName || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className="absolute -bottom-1 -right-1 text-xl">{medal}</span>
      </div>
      <p className={`w-full truncate text-sm font-black text-white ${row.club ? 'mb-1' : 'mb-2'}`}><span className={nameClass(row.nameStyle)}>{row.copsName || 'Unknown'}</span></p>
      {row.club && <div className="mb-2"><ClubTag club={row.club} /></div>}
      <TierBadge elo={row.elo ?? 1000} px={20} />
      <p className={`mt-2 font-black text-cyan-400 ${place === 1 ? 'text-2xl' : 'text-lg'}`}>{row.elo ?? 1000}</p>
    </div>
  );

  return row.accountId != null ? (
    <Link href={`/profile/${row.accountId}`} className="transition-transform hover:scale-[1.03]">
      {content}
    </Link>
  ) : (
    content
  );
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonName, setSeasonName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d?.players) ? d.players : []); setLoading(false); })
      .catch(() => setLoading(false));
    fetch('/api/season').then(r => (r.ok ? r.json() : null)).then(d => setSeasonName(d?.active?.name ?? null)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <CosmeticStyles />

      <div className="relative mx-auto max-w-3xl px-6 py-10 md:py-16">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 font-bold text-gray-400 transition-colors hover:text-cyan-400">
          <ArrowLeft size={20} /> BACK TO HUB
        </Link>

        <div className="mb-10 text-center">
          <Trophy className="mx-auto mb-3 text-cyan-400" size={28} />
          <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent">
            LEADERBOARD
          </h1>
          <p className="mt-2 text-sm font-bold uppercase tracking-widest text-gray-500">
            {seasonName ? `${seasonName} · ` : ''}Top 50 by rating
          </p>
        </div>

        {!loading && rows.length > 0 && (
          <div className="mb-10 flex items-end justify-center gap-2 sm:gap-4">
            {rows[1] && <PodiumCard row={rows[1]} place={2} />}
            {rows[0] && <PodiumCard row={rows[0]} place={1} />}
            {rows[2] && <PodiumCard row={rows[2]} place={3} />}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-24 text-cyan-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="font-bold uppercase tracking-widest">Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-24 text-center font-bold uppercase tracking-widest text-gray-600">No players yet.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
            {/* header */}
            <div className="grid grid-cols-[3rem_1fr_5rem_5rem] gap-2 border-b border-white/10 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 sm:grid-cols-[3rem_1fr_6rem_6rem_5rem_5rem]">
              <span>#</span>
              <span>Player</span>
              <span className="hidden text-center sm:block">W / L</span>
              <span className="hidden text-center sm:block">Form</span>
              <span className="text-center">Win%</span>
              <span className="text-right">Rating</span>
            </div>

            {rows.map((r, i) => {
              const games = (r.wins ?? 0) + (r.losses ?? 0);
              const winRate = games > 0 ? Math.round(((r.wins ?? 0) / games) * 100) : 0;
              const rowClass =
                'grid grid-cols-[3rem_1fr_5rem_5rem] items-center gap-2 border-b border-white/5 px-5 py-4 transition-colors last:border-0 hover:bg-white/[0.03] sm:grid-cols-[3rem_1fr_6rem_6rem_5rem_5rem]';
              const inner = (
                <>
                  <span className={`text-lg font-black ${rankAccent(i)}`}>{i + 1}</span>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`block h-8 w-8 shrink-0 overflow-hidden rounded-full ${r.frame ? frameClass(r.frame) : 'ring-1 ring-white/10'}`}>
                      {r.avatar ? (
                        <img src={r.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-black text-white">
                          {(r.copsName || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <TierBadge elo={r.elo ?? 1000} px={20} />
                    <span className="truncate font-bold text-white"><span className={nameClass(r.nameStyle)}>{r.copsName || 'Unknown'}</span></span>
                    {r.club && <ClubTag club={r.club} className="shrink-0" />}
                  </div>
                  <span className="hidden text-center text-sm font-bold sm:block">
                    <span className="text-emerald-400">{r.wins ?? 0}</span>
                    <span className="text-gray-600"> / </span>
                    <span className="text-red-400">{r.losses ?? 0}</span>
                  </span>
                  <span className="hidden items-center justify-center gap-1 sm:flex">
                    {r.form && r.form.length > 0 ? (
                      [...r.form].reverse().map((res, j) => (
                        <span key={j} title={res} className={`h-2.5 w-2.5 rounded-sm ${res === 'W' ? 'bg-emerald-400' : 'bg-red-500'}`} />
                      ))
                    ) : (
                      <span className="text-xs text-gray-700">—</span>
                    )}
                  </span>
                  <span className="text-center text-sm font-bold text-gray-300">{winRate}%</span>
                  <span className="text-right text-lg font-black text-cyan-400">{r.elo ?? 1000}</span>
                </>
              );
              return r.accountId != null ? (
                <Link key={i} href={`/profile/${r.accountId}`} className={rowClass}>
                  {inner}
                </Link>
              ) : (
                <div key={i} className={rowClass}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
