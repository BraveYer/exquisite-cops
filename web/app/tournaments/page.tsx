'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trophy, Plus, Loader2, X, Users, Crown, Gift } from 'lucide-react';
import PageBackground from '../../components/PageBackground';

type TItem = {
  id: string;
  name: string;
  prize: string;
  size: number;
  status: 'open' | 'live' | 'completed';
  participantCount: number;
  champion: { copsName: string } | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') return <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live</span>;
  if (status === 'open') return <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-cyan-300">Open</span>;
  return <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-gray-500">Ended</span>;
}

export default function TournamentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [list, setList] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [prize, setPrize] = useState('');
  const [size, setSize] = useState(8);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/tournaments', { cache: 'no-store' });
      const d = r.ok ? await r.json() : { tournaments: [] };
      setList(d.tournaments || []);
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
    if (!session) {
      setIsStaff(false);
      return;
    }
    fetch('/api/user')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIsStaff(['admin', 'mod'].includes(d?.staffLevel)))
      .catch(() => {});
  }, [session]);

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name, description: desc, prize, size }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || 'Could not create.');
      else router.push(`/tournaments/${d.id}`);
    } catch {
      setErr('Could not create.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <div className="relative mx-auto max-w-3xl px-6 py-10 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Compete</div>
            <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">Tournaments</h1>
          </div>
          {isStaff && (
            <button onClick={() => { setCreating(true); setErr(''); setName(''); setDesc(''); setPrize(''); setSize(8); }} className="flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-violet-400">
              <Plus size={15} /> Create
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-cyan-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <Trophy size={28} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm font-bold uppercase tracking-widest text-gray-500">No tournaments yet</p>
            {isStaff && <p className="mt-2 text-xs text-gray-600">Create the first one.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`} className="block rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-lg font-black text-white">{t.name}</p>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-gray-400">
                  <span className="flex items-center gap-1.5"><Users size={13} /> {t.participantCount}/{t.size}</span>
                  {t.prize ? <span className="flex items-center gap-1.5 text-amber-300"><Gift size={13} /> {t.prize}</span> : null}
                  {t.status === 'completed' && t.champion ? <span className="flex items-center gap-1.5 text-yellow-400"><Crown size={13} /> {t.champion.copsName}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCreating(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c12] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-white"><Trophy size={18} className="text-violet-300" /> New tournament</h2>
              <button onClick={() => setCreating(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>

            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 48))} placeholder="Weekend Cup" className="mb-3 w-full rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none" />

            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500">Prize</label>
            <input value={prize} onChange={(e) => setPrize(e.target.value.slice(0, 120))} placeholder="e.g. 500 credits + a role" className="mb-3 w-full rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none" />

            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500">Bracket size</label>
            <div className="mb-3 flex gap-2">
              {[4, 8, 16, 32].map((s) => (
                <button key={s} onClick={() => setSize(s)} className={`flex-1 rounded-xl border py-2 text-sm font-black transition-colors ${size === s ? 'border-violet-400 bg-violet-500/20 text-violet-200' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}>
                  {s}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500">Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 300))} rows={2} placeholder="Rules, schedule, anything players should know" className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none" />

            {err ? <p className="mb-2 text-xs font-bold text-red-400">{err}</p> : null}

            <button onClick={submit} disabled={busy || name.trim().length < 2} className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Trophy size={15} />} Create tournament
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
