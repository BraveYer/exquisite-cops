'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Ticket, Coins, Sparkles, Check, Lock, Loader2, Crown, Star } from 'lucide-react';
import PageBackground from '../../components/PageBackground';

type Reward = { type: 'ep' | 'cosmetic'; amount?: number; itemId?: string; label: string };
type Tier = {
  tier: number;
  free: Reward;
  premium: Reward;
  reached: boolean;
  freeClaimed: boolean;
  premiumClaimed: boolean;
  freeClaimable: boolean;
  premiumClaimable: boolean;
};
type Bp = {
  season: { id: string; name: string };
  xp: number;
  tier: number;
  xpIntoTier: number;
  xpPerTier: number;
  maxTier: number;
  premium: boolean;
  premiumCost: number;
  tiers: Tier[];
};

function RewardChip({ r, dim }: { r: Reward; dim?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-sm font-bold ${dim ? 'text-gray-500' : r.type === 'ep' ? 'text-amber-300' : 'text-violet-300'}`}>
      {r.type === 'ep' ? <Coins size={14} className={dim ? 'text-gray-600' : 'text-amber-400'} /> : <Sparkles size={14} className={dim ? 'text-gray-600' : 'text-violet-400'} />}
      {r.label}
    </span>
  );
}

export default function BattlePassPage() {
  const { data: session } = useSession();
  const [bp, setBp] = useState<Bp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/battlepass', { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      if (d && !d.error) setBp(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) load();
    else setLoading(false);
  }, [session, load]);

  const act = async (key: string, payload: any) => {
    setBusy(key);
    setMsg('');
    try {
      const r = await fetch('/api/battlepass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d?.error || 'Something went wrong.');
      else if (payload.action === 'claimAll') setMsg(`Claimed ${d.credited || 0} EP${d.items ? ` + ${d.items} cosmetic${d.items > 1 ? 's' : ''}` : ''}!`);
      else if (payload.action === 'unlockPremium') setMsg('Premium unlocked! 🎉');
      else if (d.reward) setMsg(d.reward.type === 'ep' ? `+${d.reward.amount} EP` : `Unlocked ${d.reward.label}!`);
      await load();
    } catch {
      setMsg('Something went wrong.');
    } finally {
      setBusy('');
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#070709] text-white">
        <PageBackground />
        <div className="relative mx-auto max-w-md px-6 py-24 text-center">
          <Ticket size={30} className="mx-auto mb-4 text-gray-600" />
          <h1 className="text-2xl font-black">Battle Pass</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to earn seasonal rewards.</p>
          <button onClick={() => signIn('discord', { callbackUrl: '/battlepass' })} className="mt-6 rounded-full bg-white px-6 py-2 text-sm font-bold text-black hover:bg-cyan-400">Connect</button>
        </div>
      </div>
    );
  }

  const pct = bp ? Math.round((bp.xpIntoTier / bp.xpPerTier) * 100) : 0;
  const anyClaimable = bp?.tiers.some((t) => t.freeClaimable || t.premiumClaimable);

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <div className="relative mx-auto max-w-3xl px-6 py-10 md:py-14">
        <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Battle Pass</div>
        <h1 className="mb-6 bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">{bp?.season.name || 'Season'}</h1>

        {loading ? (
          <div className="flex justify-center py-20 text-cyan-400"><Loader2 className="animate-spin" size={28} /></div>
        ) : !bp ? (
          <p className="text-sm text-gray-500">Could not load the battle pass.</p>
        ) : (
          <>
            {/* Progress */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500">Tier</p>
                  <p className="text-3xl font-black text-white">{bp.tier}<span className="text-lg text-gray-600">/{bp.maxTier}</span></p>
                </div>
                <p className="text-xs font-bold text-gray-500">{bp.tier >= bp.maxTier ? 'Max tier reached' : `${bp.xpIntoTier} / ${bp.xpPerTier} XP to tier ${bp.tier + 1}`}</p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${bp.tier >= bp.maxTier ? 100 : pct}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-gray-600">Earn XP by playing matches — {'\u2248'} 100 XP per match, +150 per win.</p>
            </div>

            {/* Premium + claim all */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {bp.premium ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-4 py-2 text-sm font-black uppercase tracking-wider text-amber-400"><Crown size={15} /> Premium unlocked</span>
              ) : (
                <button onClick={() => act('premium', { action: 'unlockPremium' })} disabled={!!busy} className="flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-sm font-black uppercase tracking-wider text-black hover:bg-amber-400 disabled:opacity-50">
                  <Crown size={15} /> Unlock premium · {bp.premiumCost.toLocaleString()} EP
                </button>
              )}
              <button onClick={() => act('all', { action: 'claimAll' })} disabled={!!busy || !anyClaimable} className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                Claim all
              </button>
            </div>

            {msg ? <p className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-200">{msg}</p> : null}

            {/* Track header */}
            <div className="mt-6 grid grid-cols-[3rem_1fr_1fr] gap-3 px-1 pb-2 text-[11px] font-black uppercase tracking-widest text-gray-600">
              <span>Tier</span>
              <span>Free</span>
              <span className="flex items-center gap-1"><Crown size={12} className="text-amber-500" /> Premium</span>
            </div>

            {/* Tiers */}
            <div className="space-y-2">
              {bp.tiers.map((t) => (
                <div key={t.tier} className={`grid grid-cols-[3rem_1fr_1fr] items-center gap-3 rounded-2xl border p-3 ${t.reached ? 'border-white/15 bg-white/[0.04]' : 'border-white/[0.06] bg-white/[0.01] opacity-70'}`}>
                  {/* tier badge */}
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black ${t.reached ? 'bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-white' : 'bg-white/5 text-gray-600'}`}>
                    {t.reached ? (t.tier) : <Lock size={14} />}
                  </div>

                  {/* free */}
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2">
                    <RewardChip r={t.free} dim={!t.reached} />
                    {t.freeClaimed ? (
                      <Check size={16} className="shrink-0 text-emerald-400" />
                    ) : t.freeClaimable ? (
                      <button onClick={() => act(`f${t.tier}`, { action: 'claim', tier: t.tier, track: 'free' })} disabled={!!busy} className="shrink-0 rounded-full bg-cyan-500 px-3 py-1 text-[11px] font-black uppercase text-black hover:bg-cyan-400 disabled:opacity-50">
                        {busy === `f${t.tier}` ? <Loader2 size={11} className="animate-spin" /> : 'Claim'}
                      </button>
                    ) : (
                      <Lock size={13} className="shrink-0 text-gray-600" />
                    )}
                  </div>

                  {/* premium */}
                  <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${bp.premium ? 'bg-amber-500/[0.06]' : 'bg-black/20'}`}>
                    <RewardChip r={t.premium} dim={!t.reached || !bp.premium} />
                    {t.premiumClaimed ? (
                      <Check size={16} className="shrink-0 text-amber-400" />
                    ) : t.premiumClaimable ? (
                      <button onClick={() => act(`p${t.tier}`, { action: 'claim', tier: t.tier, track: 'premium' })} disabled={!!busy} className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black uppercase text-black hover:bg-amber-400 disabled:opacity-50">
                        {busy === `p${t.tier}` ? <Loader2 size={11} className="animate-spin" /> : 'Claim'}
                      </button>
                    ) : (
                      <Lock size={13} className="shrink-0 text-gray-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
