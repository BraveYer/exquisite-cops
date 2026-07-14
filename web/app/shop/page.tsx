'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Coins, Gift, Check, Loader2, Zap, ShoppingBag, Flame, Trophy } from 'lucide-react';
import PageBackground from '../../components/PageBackground';
import { CosmeticStyles, frameClass, nameClass, themeClass } from '../../components/ProfileCosmetics';
import EpPacks from '../../components/EpPacks';
import Bundles from '../../components/Bundles';
import ReferralCard from '../../components/ReferralCard';
import SupporterCard from '../../components/SupporterCard';
import { COSMETICS, RARITY_COLOR, isAvailable, secondsLeft, isSeasonal } from '../../lib/shop';

function fmtLeft(sec: number): string {
  const d = Math.floor(sec / 86400);
  if (d >= 1) return `${d}d left`;
  const h = Math.floor(sec / 3600);
  if (h >= 1) return `${h}h left`;
  const m = Math.floor(sec / 60);
  return `${Math.max(1, m)}m left`;
}

type Eco = {
  balance: number;
  items: string[];
  equipped: { frame: string | null; name: string | null; theme: string | null };
  missions: { id: string; type: 'daily' | 'weekly'; title: string; target: number; progress: number; reward: number; claimed: boolean; claimable: boolean }[];
  achievements: { id: string; title: string; desc: string; target: number; progress: number; reward: number; claimed: boolean; claimable: boolean }[];
  dailyClaimable: boolean;
  dailyBonus: number;
  streak: number;
  nextDailyReward: number;
  dailyDeals?: { id: string; price: number; orig: number }[];
  dealResetSeconds?: number;
};

function Preview({ id, slot }: { id: string; slot: string }) {
  if (slot === 'frame') {
    return (
      <div className={`h-14 w-14 ${frameClass(id)}`}>
        <div className="h-full w-full rounded-full bg-gradient-to-br from-cyan-500/40 to-violet-500/40" />
      </div>
    );
  }
  if (slot === 'theme') {
    return <div className={`h-14 w-14 rounded-lg ${themeClass(id)}`} />;
  }
  return <span className={`text-2xl font-black text-white ${nameClass(id)}`}>Aa</span>;
}

export default function ShopPage() {
  const { data: session } = useSession();
  const [eco, setEco] = useState<Eco | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'shop' | 'earn'>('shop');
  const [slotTab, setSlotTab] = useState<'all' | 'frame' | 'name' | 'theme'>('all');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/economy', { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      if (d) setEco(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, payload: any) => {
    setBusy(key);
    setMsg('');
    try {
      const r = await fetch('/api/economy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d?.error || 'Something went wrong.');
      else if (d.reward) setMsg(`+${d.reward} EP claimed!`);
      else if (d.credited) setMsg(`+${d.credited} EP added (demo).`);
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
          <ShoppingBag size={30} className="mx-auto mb-4 text-gray-600" />
          <h1 className="text-2xl font-black">Shop</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to earn EP and buy cosmetics.</p>
          <button onClick={() => signIn('discord', { callbackUrl: '/shop' })} className="mt-6 rounded-full bg-white px-6 py-2 text-sm font-bold text-black hover:bg-cyan-400">Connect</button>
        </div>
      </div>
    );
  }

  const balance = eco?.balance ?? 0;
  const items = eco?.items ?? [];
  const equipped = eco?.equipped ?? { frame: null, name: null, theme: null };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <CosmeticStyles />
      <div className="relative mx-auto max-w-3xl px-6 py-10 md:py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Store</div>
            <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">Shop</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2">
            <Coins size={18} className="text-amber-400" />
            <span className="text-lg font-black text-amber-300">{balance.toLocaleString()}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-500/70">EP</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-white/10">
          {(['shop', 'earn'] as const).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${tab === tb ? 'border-cyan-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {tb === 'shop' ? 'Cosmetics' : 'Get EP'}
            </button>
          ))}
        </div>

        {msg ? <p className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-200">{msg}</p> : null}

        {loading ? (
          <div className="flex justify-center py-20 text-cyan-400"><Loader2 className="animate-spin" size={28} /></div>
        ) : tab === 'shop' ? (
          <div>
            {(() => {
              const now = Date.now();
              const active = COSMETICS.filter((c) => isSeasonal(c) && isAvailable(c, now));
              if (active.length === 0) return null;
              const soonest = active.map((c) => secondsLeft(c, now)).filter((s): s is number => s != null).sort((a, b) => a - b)[0];
              return (
                <div className="mb-8 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-500/[0.1] to-transparent p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-black uppercase tracking-widest text-fuchsia-300">⏳ Limited time</h2>
                    {soonest != null && <span className="text-xs font-black text-fuchsia-300">{fmtLeft(soonest)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {active.map((c) => (
                      <span key={c.id} className="rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-100">{c.name}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500">These leave the shop when the timer ends — grab them while you can.</p>
                </div>
              );
            })()}
            {eco?.dailyDeals && eco.dailyDeals.length > 0 && (
              <div className="mb-8 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.08] to-transparent p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-black uppercase tracking-widest text-amber-300">🔥 Today&apos;s deals · 25% off</h2>
                  {typeof eco.dealResetSeconds === 'number' && (
                    <span className="text-xs font-black text-amber-300">Resets in {Math.floor(eco.dealResetSeconds / 3600)}h {Math.floor((eco.dealResetSeconds % 3600) / 60)}m</span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {eco.dailyDeals.map((d) => {
                    const c = COSMETICS.find((x) => x.id === d.id);
                    if (!c) return null;
                    const owned = (eco.items || []).includes(c.id);
                    return (
                      <div key={d.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                        <div className="mb-2 flex justify-center"><Preview id={c.id} slot={c.slot} /></div>
                        <p className="truncate text-xs font-bold text-white">{c.name}</p>
                        <div className="my-1 flex items-center justify-center gap-1.5">
                          <span className="text-sm font-black text-amber-300">{d.price.toLocaleString()}</span>
                          <span className="text-[11px] text-gray-500 line-through">{d.orig.toLocaleString()}</span>
                        </div>
                        {owned ? (
                          <p className="text-[11px] font-bold text-gray-500">Owned</p>
                        ) : (
                          <button onClick={() => act(c.id, { action: 'buy', itemId: c.id })} disabled={!!busy || balance < d.price} className="w-full rounded-full bg-amber-500 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-400 disabled:opacity-40">
                            {busy === c.id ? '…' : balance < d.price ? 'Need EP' : 'Buy'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mb-8">
              <Bundles onChanged={load} />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {([['all', 'All'], ['frame', 'Avatar frames'], ['name', 'Name styles'], ['theme', 'Profile themes']] as const).map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => setSlotTab(s)}
                  className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-colors ${slotTab === s ? 'bg-cyan-500 text-black' : 'border border-white/10 text-gray-400 hover:text-white'}`}
                >
                  {label} <span className="opacity-60">{s === 'all' ? COSMETICS.length : COSMETICS.filter((c) => c.slot === s).length}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {COSMETICS.filter((c) => slotTab === 'all' || c.slot === slotTab).map((c) => {
              const owned = items.includes(c.id);
              const isEquipped = equipped[c.slot] === c.id;
              const rc = RARITY_COLOR[c.rarity];
              const seasonal = isSeasonal(c);
              const avail = isAvailable(c);
              const left = secondsLeft(c);
              return (
                <div key={c.id} className={`rounded-2xl border p-4 ${seasonal ? 'border-fuchsia-500/25 bg-fuchsia-500/[0.04]' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-black/30">
                      <Preview id={c.id} slot={c.slot} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-black text-white">{c.name}</p>
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase" style={{ color: rc, backgroundColor: `${rc}22` }}>{c.rarity}</span>
                        {seasonal && (
                          <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-fuchsia-300">
                            {avail ? (left != null ? `⏳ ${fmtLeft(left)}` : 'Limited') : 'Ended'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{c.desc}</p>
                      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-gray-600">{c.slot === 'frame' ? 'Avatar frame' : c.slot === 'theme' ? 'Profile theme' : 'Name style'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-black text-amber-300"><Coins size={14} className="text-amber-400" /> {c.price.toLocaleString()}</span>
                    {isEquipped ? (
                      <button onClick={() => act(c.id, { action: 'unequip', slot: c.slot })} disabled={!!busy} className="rounded-full border border-cyan-500/40 px-4 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50">Equipped ✓</button>
                    ) : owned ? (
                      <button onClick={() => act(c.id, { action: 'equip', itemId: c.id })} disabled={!!busy} className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50">Equip</button>
                    ) : !avail ? (
                      <button disabled className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-gray-600">No longer available</button>
                    ) : (
                      <button onClick={() => act(c.id, { action: 'buy', itemId: c.id })} disabled={!!busy || balance < c.price} className="rounded-full bg-cyan-500 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                        {busy === c.id ? <Loader2 size={13} className="animate-spin" /> : balance < c.price ? 'Need EP' : 'Buy'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Daily bonus */}
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Gift size={22} className="text-emerald-400" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-white">Daily bonus</p>
                  {(eco?.streak ?? 0) > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-black text-orange-400">
                      <Flame size={11} /> {eco?.streak} day streak
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {eco?.dailyClaimable ? `Claim ${eco?.nextDailyReward ?? 50} EP today` : 'Come back tomorrow to keep your streak.'} · +10 EP per streak day
                </p>
              </div>
              <button onClick={() => act('daily', { action: 'claimDaily' })} disabled={!!busy || !eco?.dailyClaimable} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-black uppercase tracking-wider text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">
                {eco?.dailyClaimable ? `Claim ${eco?.nextDailyReward ?? ''}` : 'Claimed'}
              </button>
            </div>

            {/* Missions */}
            <div className="space-y-6">
              {(['daily', 'weekly'] as const).map((grp) => {
                const list = (eco?.missions || []).filter((m) => m.type === grp);
                if (list.length === 0) return null;
                const barColor = grp === 'weekly' ? 'bg-violet-500' : 'bg-cyan-500';
                return (
                  <div key={grp}>
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
                      <Zap size={15} className={grp === 'weekly' ? 'text-violet-400' : 'text-cyan-400'} /> {grp === 'weekly' ? 'Weekly missions' : 'Daily missions'}
                    </h2>
                    <div className="space-y-2">
                      {list.map((m) => {
                        const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                        return (
                          <div key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-white">{m.title}</p>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                                <p className="mt-1 text-[11px] text-gray-500">{m.progress}/{m.target}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="mb-1 flex items-center justify-end gap-1 text-sm font-black text-amber-300"><Coins size={13} className="text-amber-400" /> {m.reward}</p>
                                <button onClick={() => act(m.id, { action: 'claimMission', missionId: m.id })} disabled={!!busy || !m.claimable} className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                                  {m.claimed ? 'Done' : m.claimable ? 'Claim' : 'Locked'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Achievements */}
            <div>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400"><Trophy size={15} className="text-amber-400" /> Achievements</h2>
              <div className="space-y-2">
                {(eco?.achievements || []).map((a) => {
                  const pct = Math.min(100, Math.round((a.progress / a.target) * 100));
                  return (
                    <div key={a.id} className={`rounded-2xl border p-4 ${a.claimed ? 'border-amber-400/20 bg-amber-500/[0.04]' : 'border-white/10 bg-white/[0.03]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-white">{a.title}</p>
                            {a.claimed && <Check size={13} className="text-amber-400" />}
                          </div>
                          <p className="text-xs text-gray-500">{a.desc}</p>
                          {!a.claimed && (
                            <>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                              </div>
                              <p className="mt-1 text-[11px] text-gray-500">{a.progress}/{a.target}</p>
                            </>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="mb-1 flex items-center justify-end gap-1 text-sm font-black text-amber-300"><Coins size={13} className="text-amber-400" /> {a.reward}</p>
                          <button onClick={() => act(a.id, { action: 'claimAchievement', achId: a.id })} disabled={!!busy || !a.claimable} className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
                            {a.claimed ? 'Done' : a.claimable ? 'Claim' : 'Locked'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EP packs (PayPal or demo) */}
            <SupporterCard onChange={() => load()} />

            <ReferralCard />

            <EpPacks onCredited={() => load()} />
          </div>
        )}
      </div>
    </div>
  );
}
