'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2, Swords, Medal, User } from 'lucide-react';
import { getTier } from '../../lib/tiers';
import PageBackground from '../../components/PageBackground';
import { CosmeticStyles, nameClass } from '../../components/ProfileCosmetics';

type Results = {
  players: { accountId: number | null; copsName: string; elo: number; avatar: string | null; nameStyle: string | null }[];
  clubs: { id: string; name: string; tag: string; color: string | null }[];
  tournaments: { id: string; name: string; status: string }[];
};

const EMPTY: Results = { players: [], clubs: [], tournaments: [] };

function SearchInner() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [res, setRes] = useState<Results>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setRes(EMPTY);
      setSearched(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
        const d = r.ok ? await r.json() : EMPTY;
        setRes(d);
        setSearched(true);
      } catch {
        setRes(EMPTY);
      } finally {
        setBusy(false);
      }
    }, 300);
  }, [q]);

  const total = res.players.length + res.clubs.length + res.tournaments.length;

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <CosmeticStyles />
      <div className="relative mx-auto max-w-2xl px-6 py-10 md:py-14">
        <h1 className="mb-6 flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">Search</h1>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          {busy && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-500" />}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players, clubs, tournaments…"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 pl-12 pr-11 text-base text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>

        {q.trim().length < 2 ? (
          <p className="py-16 text-center text-sm text-gray-600">Type at least 2 characters.</p>
        ) : searched && total === 0 ? (
          <p className="py-16 text-center text-sm text-gray-600">No results for “{q}”.</p>
        ) : (
          <div className="space-y-6">
            {res.players.length > 0 && (
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500"><User size={13} /> Players</h2>
                <div className="space-y-1">
                  {res.players.map((p) => (
                    <Link key={p.accountId ?? p.copsName} href={`/profile/${p.accountId}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.05]">
                      {p.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatar} alt="" className="h-9 w-9 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${getTier(p.elo).color}55` }} />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-black" style={{ color: getTier(p.elo).color }}>{(p.copsName || '?').charAt(0).toUpperCase()}</span>
                      )}
                      <span className={`flex-1 truncate text-sm font-bold text-white ${nameClass(p.nameStyle)}`}>{p.copsName}</span>
                      <span className="text-xs font-bold" style={{ color: getTier(p.elo).color }}>{p.elo}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {res.clubs.length > 0 && (
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500"><Swords size={13} /> Clubs</h2>
                <div className="space-y-1">
                  {res.clubs.map((c) => {
                    const accent = c.color || '#a78bfa';
                    return (
                      <Link key={c.id} href={`/clans/${c.id}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.05]">
                        <span className="rounded-lg px-2 py-1 text-xs font-black" style={{ backgroundColor: `${accent}22`, color: accent }}>[{c.tag}]</span>
                        <span className="flex-1 truncate text-sm font-bold text-white">{c.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {res.tournaments.length > 0 && (
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500"><Medal size={13} /> Tournaments</h2>
                <div className="space-y-1">
                  {res.tournaments.map((t) => (
                    <Link key={t.id} href={`/tournaments/${t.id}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.05]">
                      <span className="flex-1 truncate text-sm font-bold text-white">{t.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${t.status === 'live' ? 'bg-emerald-500/15 text-emerald-400' : t.status === 'open' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/[0.06] text-gray-500'}`}>{t.status}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070709] text-cyan-400"><Loader2 className="animate-spin" size={28} /></div>}>
      <SearchInner />
    </Suspense>
  );
}
