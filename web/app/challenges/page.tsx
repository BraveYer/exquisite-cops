'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, Check, X, Loader2, MapPin } from 'lucide-react';
import PageBackground from '../../components/PageBackground';

type Incoming = { id: string; fromName: string; fromAccountId: number; map: string; stake: number; createdAt: string };
type Outgoing = { id: string; toName: string; toAccountId: number; map: string; stake: number; createdAt: string };

export default function ChallengesPage() {
  const router = useRouter();
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = () =>
    fetch('/api/challenge', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setIncoming(d.incoming || []);
          setOutgoing(d.outgoing || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  const act = async (id: string, action: 'accept' | 'decline' | 'cancel') => {
    setBusy(id + action);
    try {
      const r = await fetch('/api/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, challengeId: id }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && action === 'accept' && d.matchId) {
        router.push(`/match/${d.matchId}`);
        return;
      }
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="relative min-h-screen">
      <PageBackground />
      <div className="relative mx-auto max-w-2xl px-4 py-12">
        <div className="mb-2 text-center text-sm font-bold uppercase tracking-[0.3em] text-red-500">Duels</div>
        <h1 className="mb-8 flex items-center justify-center gap-2 text-center text-4xl font-black tracking-tighter">
          <Swords size={30} className="text-red-400" /> Challenges
        </h1>

        {loading ? (
          <div className="flex justify-center py-16 text-cyan-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-gray-400">Incoming</h2>
              {incoming.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-600">No incoming challenges.</p>
              ) : (
                <div className="space-y-2">
                  {incoming.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4">
                      <div>
                        <p className="font-black text-white">{c.fromName}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-400"><MapPin size={12} /> {c.map}{c.stake > 0 ? <span className="ml-1 font-black text-amber-300"> · 🏆 {c.stake * 2} EP pot</span> : null}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => act(c.id, 'accept')} disabled={!!busy} className="flex items-center gap-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-black hover:bg-emerald-400 disabled:opacity-40">
                          <Check size={14} /> Accept
                        </button>
                        <button onClick={() => act(c.id, 'decline')} disabled={!!busy} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white disabled:opacity-40">
                          <X size={14} /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-gray-400">Sent</h2>
              {outgoing.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-600">You haven&apos;t sent any challenges.</p>
              ) : (
                <div className="space-y-2">
                  {outgoing.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div>
                        <p className="font-black text-white">{c.toName}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-400"><MapPin size={12} /> {c.map}{c.stake > 0 ? <span className="ml-1 font-black text-amber-300"> · 🏆 {c.stake * 2} EP pot</span> : null} · waiting for response</p>
                      </div>
                      <button onClick={() => act(c.id, 'cancel')} disabled={!!busy} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white disabled:opacity-40">
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
