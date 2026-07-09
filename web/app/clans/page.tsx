'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Shield, Search, Plus, Loader2, X, ChevronRight } from 'lucide-react';
import PageBackground from '../../components/PageBackground';
import { ClubTagStyles, clubTagClass } from '../../components/ClubCosmetics';

type ClanItem = { id: string; name: string; tag: string; description: string; color: string | null; banner: string | null; memberCount: number; avgElo: number; totalWins: number; level?: number; tagStyle?: string | null; recruiting?: boolean };
type MyClan = { id: string; name: string; tag: string; role: string } | null;

export default function ClansPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [clans, setClans] = useState<ClanItem[]>([]);
  const [myClan, setMyClan] = useState<MyClan>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<'members' | 'elo' | 'wins'>('members');
  const [recruitingOnly, setRecruitingOnly] = useState(false);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const r = await fetch(`/api/clans${query ? `?q=${encodeURIComponent(query)}` : ''}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : { clans: [], myClan: null };
      setClans(d.clans || []);
      setMyClan(d.myClan || null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const submitCreate = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name, tag, description: desc }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || 'Could not create clan.');
      else router.push(`/clans/${d.id}`);
    } catch {
      setErr('Could not create clan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <ClubTagStyles />
      <div className="relative mx-auto max-w-3xl px-6 py-10 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Organizations</div>
            <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">Clubs</h1>
          </div>
          {session && !myClan && (
            <button
              onClick={() => {
                setCreating(true);
                setErr('');
                setName('');
                setTag('');
                setDesc('');
              }}
              className="flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-violet-400"
            >
              <Plus size={15} /> Create
            </button>
          )}
        </div>

        {/* Your club */}
        {myClan && (
          <Link
            href={`/clans/${myClan.id}`}
            className="mb-6 flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.06] px-4 py-3 transition-colors hover:bg-cyan-500/[0.1]"
          >
            <span className="rounded-lg bg-cyan-500/20 px-2 py-1 text-sm font-black text-cyan-300">[{myClan.tag}]</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-white">{myClan.name}</p>
              <p className="text-[11px] uppercase tracking-widest text-gray-500">Your club · {myClan.role}</p>
            </div>
            <ChevronRight size={18} className="text-gray-500" />
          </Link>
        )}

        {/* Search */}
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <Search size={16} className="text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clubs by name or tag…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
          />
        </div>

        {/* Sort */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-gray-600">Rank by</span>
          {(['members', 'elo', 'wins'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors ${sortBy === s ? 'bg-cyan-500 text-black' : 'border border-white/10 text-gray-400 hover:text-white'}`}
            >
              {s === 'elo' ? 'Avg ELO' : s === 'wins' ? 'Wins' : 'Members'}
            </button>
          ))}
          <button
            onClick={() => setRecruitingOnly((v) => !v)}
            className={`ml-2 rounded-full px-3 py-1 text-xs font-bold transition-colors ${recruitingOnly ? 'bg-emerald-500 text-black' : 'border border-white/10 text-gray-400 hover:text-white'}`}
          >
            Recruiting
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-cyan-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : clans.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <Shield size={28} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm font-bold uppercase tracking-widest text-gray-500">{q ? 'No clubs found' : 'No clubs yet'}</p>
            {session && !myClan && !q && <p className="mt-2 text-xs text-gray-600">Be the first to create one.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {[...clans]
              .filter((c) => !recruitingOnly || c.recruiting !== false)
              .sort((a, b) => (sortBy === 'elo' ? b.avgElo - a.avgElo : sortBy === 'wins' ? b.totalWins - a.totalWins : b.memberCount - a.memberCount) || a.name.localeCompare(b.name))
              .map((c, i) => {
                const accent = c.color || '#a78bfa';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                const metric = sortBy === 'elo' ? `${c.avgElo} ELO` : sortBy === 'wins' ? `${c.totalWins} wins` : `${c.memberCount} members`;
                return (
                  <Link
                    key={c.id}
                    href={`/clans/${c.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                  >
                    <span className="w-6 shrink-0 text-center text-sm font-black text-gray-500">{medal || i + 1}</span>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-black ${clubTagClass(c.tagStyle)}`} style={{ backgroundColor: `${accent}22`, color: accent }}>
                      [{c.tag}]
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-black text-white">{c.name}</p>
                        {c.level ? <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-300">Lvl {c.level}</span> : null}
                        {c.recruiting !== false && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">Recruiting</span>}
                      </div>
                      <p className="truncate text-xs text-gray-500">
                        {c.memberCount} members · {c.avgElo} avg ELO · {c.totalWins} wins
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs font-black text-cyan-400">{metric}</div>
                  </Link>
                );
              })}
          </div>
        )}

        {!session && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-sm text-gray-500">Sign in to create or join a club.</p>
            <button onClick={() => signIn('discord', { callbackUrl: '/clans' })} className="mt-4 rounded-full bg-white px-6 py-2 text-sm font-bold text-black hover:bg-cyan-400">
              Connect
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCreating(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c12] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <Shield size={18} className="text-violet-300" /> Create a club
              </h2>
              <button onClick={() => setCreating(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 32))}
              placeholder="Exquisite Elite"
              className="mb-3 w-full rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none"
            />

            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500">Tag (2–5)</label>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              placeholder="EXQ"
              className="mb-3 w-full rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm font-black tracking-widest text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none"
            />

            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="What's your clan about?"
              className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none"
            />

            {err ? <p className="mb-2 text-xs font-bold text-red-400">{err}</p> : null}

            <button
              onClick={submitCreate}
              disabled={busy || name.trim().length < 2 || tag.length < 2}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />} Create club
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
