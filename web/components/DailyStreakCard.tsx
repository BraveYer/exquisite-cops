'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Flame, Coins, Check } from 'lucide-react';

export default function DailyStreakCard() {
  const { status } = useSession();
  const [info, setInfo] = useState<{ dailyClaimable: boolean; streak: number; nextDailyReward: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);

  const load = () =>
    fetch('/api/economy', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setInfo({ dailyClaimable: !!d.dailyClaimable, streak: d.streak || 0, nextDailyReward: d.nextDailyReward || 50 }); })
      .catch(() => {});

  useEffect(() => { if (status === 'authenticated') load(); }, [status]);

  if (status !== 'authenticated' || !info) return null;

  const claim = async () => {
    if (busy || !info.dailyClaimable) return;
    setBusy(true);
    try {
      const r = await fetch('/api/economy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claimDaily' }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.reward) {
        setFlash(d.reward);
        setInfo((prev) => (prev ? { ...prev, dailyClaimable: false, streak: d.streak ?? prev.streak } : prev));
        setTimeout(() => setFlash(null), 2500);
      }
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/[0.08] to-transparent px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15">
          <Flame size={22} className="text-orange-400" />
        </div>
        <div>
          <p className="text-lg font-black text-white">
            {info.streak > 0 ? `${info.streak}-day streak` : 'Daily bonus'}
          </p>
          <p className="text-xs text-gray-400">
            {flash ? `+${flash} EP claimed! 🔥` : info.dailyClaimable ? `Claim ${info.nextDailyReward} EP today` : 'Come back tomorrow to keep it going'}
          </p>
        </div>
      </div>
      <button
        onClick={claim}
        disabled={busy || !info.dailyClaimable}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${
          info.dailyClaimable ? 'bg-orange-500 text-black hover:bg-orange-400' : 'cursor-default border border-white/10 bg-white/5 text-gray-500'
        }`}
      >
        {info.dailyClaimable ? (
          <>
            <Coins size={14} /> Claim {info.nextDailyReward}
          </>
        ) : (
          <>
            <Check size={14} /> Claimed
          </>
        )}
      </button>
    </div>
  );
}
