'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Swords, Check } from 'lucide-react';
import { MAP_POOL } from '../lib/maps';

export default function ChallengeButton({ targetAccountId }: { targetAccountId: number }) {
  const { status } = useSession();
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [stake, setStake] = useState('');

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/user', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setHidden(!u || u.accountId === targetAccountId))
      .catch(() => setHidden(true));
  }, [status, targetAccountId]);

  if (status !== 'authenticated' || hidden) return null;

  const send = async (map: string) => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', targetAccountId, map, stake: Math.max(0, Math.floor(Number(stake) || 0)) }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setSent(true);
        setOpen(false);
      } else setMsg(d?.error || 'Could not send challenge.');
    } catch {
      setMsg('Could not send challenge.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-400">
        <Check size={15} /> Challenge sent
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-4 py-2 text-sm font-black uppercase tracking-wider text-white hover:opacity-90"
      >
        <Swords size={15} /> Challenge to 1v1
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-56 rounded-2xl border border-white/10 bg-[#0d0d12] p-3 shadow-xl">
          <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500">EP stake (optional)</p>
          <input
            type="number"
            min={0}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            placeholder="0"
            className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-amber-500/40"
          />
          <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-gray-500">Pick a map</p>
          <div className="grid grid-cols-2 gap-1.5">
            {MAP_POOL.map((m) => (
              <button
                key={m}
                onClick={() => send(m)}
                disabled={busy}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-bold text-gray-200 hover:border-red-500/40 hover:text-white disabled:opacity-40"
              >
                {m}
              </button>
            ))}
          </div>
          {Number(stake) > 0 && <p className="mt-2 text-[11px] text-amber-300">Winner takes {Number(stake) * 2} EP</p>}
          {msg && <p className="mt-2 text-xs font-bold text-red-400">{msg}</p>}
        </div>
      )}
    </div>
  );
}
