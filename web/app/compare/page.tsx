'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Search, X, Swords, ArrowLeft, Crown } from 'lucide-react';
import { getTier } from '../../lib/tiers';
import PageBackground from '../../components/PageBackground';

type PData = {
  copsName?: string;
  avatar?: string | null;
  level?: number;
  elo?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  gamesPlayed?: number;
  peakElo?: number;
  kd?: { ratio: number; avgKills: number; kills: number; deaths: number } | null;
  history?: { result: 'win' | 'loss' }[];
  stats?: { longestWinStreak?: number; currentStreak?: number; currentStreakType?: 'W' | 'L' | null; bestMap?: { map: string; winRate: number; games: number } | null };
};

type SearchResult = { accountId: number; copsName: string; elo: number; avatar: string | null };

function PlayerPicker({ onPick }: { onPick: (id: number) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
        const d = r.ok ? await r.json() : { results: [] };
        setResults(d.results || []);
      } catch {
        /* ignore */
      } finally {
        setBusy(false);
      }
    }, 300);
  }, [q]);

  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a player…"
          className="w-full rounded-xl border border-white/10 bg-[#08080c] py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none"
        />
        {busy && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500" />}
      </div>
      {results.length > 0 && (
        <div className="mt-2 space-y-1">
          {results.map((p) => (
            <button
              key={p.accountId}
              onClick={() => onPick(p.accountId)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/5"
            >
              {p.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-black text-gray-400">{(p.copsName || '?').charAt(0).toUpperCase()}</span>
              )}
              <span className="flex-1 truncate text-sm font-bold text-white">{p.copsName}</span>
              <span className="text-xs font-bold" style={{ color: getTier(p.elo).color }}>{p.elo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Head({ data, onClear }: { data: PData; onClear: () => void }) {
  const tier = getTier(data.elo ?? 1000);
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <button onClick={onClear} className="absolute right-2 top-2 text-gray-500 hover:text-white"><X size={16} /></button>
      <div className="mx-auto mb-2 h-16 w-16 overflow-hidden rounded-full" style={{ boxShadow: `0 0 0 2px ${tier.color}` }}>
        {data.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-white/10 text-xl font-black text-white">{(data.copsName || '?').charAt(0).toUpperCase()}</span>
        )}
      </div>
      <p className="truncate text-lg font-black text-white">{data.copsName || 'Unknown'}</p>
      <p className="text-xs font-bold" style={{ color: tier.color }}>{tier.name}</p>
    </div>
  );
}

function Form({ history }: { history?: { result: 'win' | 'loss' }[] }) {
  const last = (history || []).slice(0, 5);
  if (last.length === 0) return <span className="text-xs text-gray-600">—</span>;
  return (
    <div className="flex gap-1">
      {last.map((h, i) => (
        <span key={i} className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-black ${h.result === 'win' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {h.result === 'win' ? 'W' : 'L'}
        </span>
      ))}
    </div>
  );
}

function CompareInner() {
  const sp = useSearchParams();
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);
  const [aData, setAData] = useState<PData | null>(null);
  const [bData, setBData] = useState<PData | null>(null);
  const [aLoad, setALoad] = useState(false);
  const [bLoad, setBLoad] = useState(false);

  useEffect(() => {
    const a = Number(sp.get('a'));
    const b = Number(sp.get('b'));
    if (Number.isFinite(a) && a > 0) setAId(a);
    if (Number.isFinite(b) && b > 0) setBId(b);
  }, [sp]);

  const fetchP = useCallback(async (id: number, setData: (d: PData | null) => void, setLoad: (b: boolean) => void) => {
    setLoad(true);
    try {
      const r = await fetch(`/api/profile/${id}`, { cache: 'no-store' });
      setData(r.ok ? await r.json() : null);
    } catch {
      setData(null);
    } finally {
      setLoad(false);
    }
  }, []);

  useEffect(() => { if (aId) fetchP(aId, setAData, setALoad); else setAData(null); }, [aId, fetchP]);
  useEffect(() => { if (bId) fetchP(bId, setBData, setBLoad); else setBData(null); }, [bId, fetchP]);

  const rows: { label: string; a: number; b: number; better: 'high' | 'low'; suffix?: string }[] = aData && bData ? [
    { label: 'ELO', a: aData.elo ?? 0, b: bData.elo ?? 0, better: 'high' },
    { label: 'Peak ELO', a: aData.peakElo ?? aData.elo ?? 0, b: bData.peakElo ?? bData.elo ?? 0, better: 'high' },
    { label: 'Wins', a: aData.wins ?? 0, b: bData.wins ?? 0, better: 'high' },
    { label: 'Losses', a: aData.losses ?? 0, b: bData.losses ?? 0, better: 'low' },
    { label: 'Win rate', a: aData.winRate ?? 0, b: bData.winRate ?? 0, better: 'high', suffix: '%' },
    { label: 'K/D ratio', a: aData.kd?.ratio ?? 0, b: bData.kd?.ratio ?? 0, better: 'high' },
    { label: 'Avg kills', a: aData.kd?.avgKills ?? 0, b: bData.kd?.avgKills ?? 0, better: 'high' },
    { label: 'Games', a: aData.gamesPlayed ?? 0, b: bData.gamesPlayed ?? 0, better: 'high' },
    { label: 'Level', a: aData.level ?? 0, b: bData.level ?? 0, better: 'high' },
    { label: 'Best streak', a: aData.stats?.longestWinStreak ?? 0, b: bData.stats?.longestWinStreak ?? 0, better: 'high' },
  ] : [];

  const winner = (r: { a: number; b: number; better: 'high' | 'low' }) => {
    if (r.a === r.b) return 0;
    const aWins = r.better === 'high' ? r.a > r.b : r.a < r.b;
    return aWins ? -1 : 1;
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <div className="relative mx-auto max-w-2xl px-6 py-8 md:py-12">
        <Link href="/leaderboard" className="mb-5 inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-white">
          <ArrowLeft size={16} /> Leaderboard
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <Swords className="text-cyan-400" size={26} />
          <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tighter text-transparent">Compare</h1>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {aLoad ? <div className="flex items-center justify-center rounded-2xl border border-white/10 py-10"><Loader2 className="animate-spin text-cyan-400" size={22} /></div> : aData ? <Head data={aData} onClear={() => setAId(null)} /> : <PlayerPicker onPick={setAId} />}
          {bLoad ? <div className="flex items-center justify-center rounded-2xl border border-white/10 py-10"><Loader2 className="animate-spin text-cyan-400" size={22} /></div> : bData ? <Head data={bData} onClear={() => setBId(null)} /> : <PlayerPicker onPick={setBId} />}
        </div>

        {aData && bData ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {rows.map((r) => {
              const w = winner(r);
              return (
                <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
                  <div className={`text-right text-lg font-black ${w === -1 ? 'text-emerald-400' : 'text-gray-300'}`}>
                    {w === -1 && <Crown size={13} className="mb-0.5 mr-1 inline text-emerald-400" />}
                    {r.a}{r.suffix || ''}
                  </div>
                  <div className="min-w-24 text-center text-[11px] font-black uppercase tracking-widest text-gray-500">{r.label}</div>
                  <div className={`text-left text-lg font-black ${w === 1 ? 'text-emerald-400' : 'text-gray-300'}`}>
                    {r.b}{r.suffix || ''}
                    {w === 1 && <Crown size={13} className="mb-0.5 ml-1 inline text-emerald-400" />}
                  </div>
                </div>
              );
            })}
            {(aData.stats?.bestMap || bData.stats?.bestMap) && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/5 px-4 py-3">
                <div className="text-right text-sm font-black text-gray-300">
                  {aData.stats?.bestMap ? `${aData.stats.bestMap.map} · ${aData.stats.bestMap.winRate}%` : '—'}
                </div>
                <div className="min-w-24 text-center text-[11px] font-black uppercase tracking-widest text-gray-500">Best map</div>
                <div className="text-left text-sm font-black text-gray-300">
                  {bData.stats?.bestMap ? `${bData.stats.bestMap.map} · ${bData.stats.bestMap.winRate}%` : '—'}
                </div>
              </div>
            )}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
              <div className="flex justify-end"><Form history={aData.history} /></div>
              <div className="min-w-24 text-center text-[11px] font-black uppercase tracking-widest text-gray-500">Recent</div>
              <div className="flex justify-start"><Form history={bData.history} /></div>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-gray-600">Pick two players to compare their stats side by side.</p>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070709] text-cyan-400"><Loader2 className="animate-spin" size={28} /></div>}>
      <CompareInner />
    </Suspense>
  );
}
