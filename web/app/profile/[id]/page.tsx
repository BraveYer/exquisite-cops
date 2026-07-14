'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { COSMETICS, getCosmetic } from '../../../lib/shop';
import { ArrowLeft, Loader2, ShieldCheck, ShieldQuestion, Swords, Medal, Award, Trophy, Flame, Zap, Sparkles, Crown, Lock, Gift, ShieldAlert, X, Star, ThumbsUp } from 'lucide-react';

const COMMEND_LABELS: Record<string, string> = { aim: 'Great aim', igl: 'Shotcaller', team: 'Good teammate', clutch: 'Clutch' };
import TierBadge from '../../../components/TierBadge';
import PageBackground from '../../../components/PageBackground';
import FriendButton from '../../../components/FriendButton';
import ChallengeButton from '../../../components/ChallengeButton';
import { CosmeticStyles, frameClass, nameClass } from '../../../components/ProfileCosmetics';
import ProfileEffect from '../../../components/ProfileEffect';
import { usePresence, PresenceLabel } from '../../../components/Presence';
import { getTier } from '../../../lib/tiers';
import { SOCIALS } from '../../../lib/socials';

type HistoryItem = { matchId: string; map: string; completedAt?: string; result: 'win' | 'loss'; eloDelta: number };
type Profile = {
  copsName?: string;
  avatar?: string | null;
  supporter?: boolean;
  socials?: Record<string, string>;
  seasonMedals?: { season: number; name: string; rank: number }[];
  achievements?: { id: string; label: string; desc: string; unlocked: boolean }[];
  eloSeries?: number[];
  stats?: {
    totalMatches: number;
    currentStreak: number;
    currentStreakType: 'W' | 'L' | null;
    longestWinStreak: number;
    bestMap: { map: string; winRate: number; games: number } | null;
    worstMap?: { map: string; winRate: number; games: number } | null;
    mostPlayedMap: { map: string; games: number } | null;
    mapBreakdown?: { map: string; winRate: number; wins: number; games: number }[];
  };
  level?: number;
  kd?: { kills: number; deaths: number; assists: number; matches: number; ratio: number; avgKills: number } | null;
  honor?: { total: number; byType: Record<string, number> };
  h2h?: { wins: number; losses: number; games: number } | null;
  highlight?: { matchId: string; map: string; result: 'win' | 'loss'; date: string | null } | null;
  verified?: boolean;
  elo?: number;
  peakElo?: number;
  wins?: number;
  losses?: number;
  gamesPlayed?: number;
  winRate?: number;
  history?: HistoryItem[];
};

const ACH_ICONS: Record<string, any> = {
  first_match: Swords,
  wins_10: Medal,
  wins_25: Award,
  wins_50: Trophy,
  streak_5: Flame,
  streak_10: Zap,
  flawless: Sparkles,
  medalist: Crown,
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'matches', label: 'Matches' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function fmtDate(s?: string) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString(); } catch { return ''; }
}

function StatTile({ label, value, sub, color = 'text-white' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`truncate text-xl font-black ${color}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-gray-500">{sub}</p> : null}
    </div>
  );
}

function EloChart({ series }: { series: number[] }) {
  if (!series || series.length < 2) return null;
  const W = 600, H = 160, pad = 6;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - pad} L${pts[0][0].toFixed(1)},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full">
      <defs>
        <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,211,238,0.35)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eloFill)" />
      <path d={line} fill="none" stroke="#22d3ee" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const { data: session } = useSession();
  const [p, setP] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<TabId>('overview');
  const [clan, setClan] = useState<{ id: string; tag: string; name: string; color?: string | null } | null>(null);
  const [cos, setCos] = useState<{ frame: string | null; name: string | null; theme: string | null }>({ frame: null, name: null, theme: null });
  const [tourneys, setTourneys] = useState<{ history: any[]; championships: number; finals: number; played: number } | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTab, setGiftTab] = useState<'ep' | 'item'>('ep');
  const [giftAmount, setGiftAmount] = useState('100');
  const [giftCos, setGiftCos] = useState('');
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMsg, setGiftMsg] = useState('');
  const [mod, setMod] = useState<{ canModerate: boolean; sanctions: any[] } | null>(null);
  const [modTick, setModTick] = useState(0);
  const [sancType, setSancType] = useState('warn');
  const [sancReason, setSancReason] = useState('');
  const [sancDur, setSancDur] = useState('');
  const [sancBusy, setSancBusy] = useState(false);

  useEffect(() => {
    if (!id || Number.isNaN(Number(id))) return;
    fetch(`/api/admin/sanctions?accountId=${id}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setMod(d); }).catch(() => {});
  }, [id, modTick]);

  const addSanction = async () => {
    setSancBusy(true);
    try {
      const r = await fetch('/api/admin/sanctions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: Number(id), type: sancType, reason: sancReason, durationHours: sancDur ? Number(sancDur) : undefined }) });
      if (r.ok) { setSancReason(''); setSancDur(''); setModTick((t) => t + 1); }
    } catch {
      /* ignore */
    } finally {
      setSancBusy(false);
    }
  };

  const revokeSanction = async (sid: string) => {
    try {
      await fetch(`/api/admin/sanctions?id=${sid}`, { method: 'DELETE' });
      setModTick((t) => t + 1);
    } catch {
      /* ignore */
    }
  };

  const grantSupporter = async (days: number) => {
    if (days < 0 && !window.confirm('Revoke supporter status?')) return;
    try {
      const r = await fetch('/api/admin/supporter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: Number(id), days }) });
      if (r.ok) window.location.reload();
    } catch {
      /* ignore */
    }
  };

  const sendGift = async () => {
    setGiftBusy(true);
    setGiftMsg('');
    try {
      const r = await fetch('/api/economy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'gift', to: Number(id), amount: Number(giftAmount) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setGiftMsg(d?.error || 'Could not send.');
      else { setGiftMsg(`Sent ${d.sent} EP to ${p?.copsName || 'them'}!`); setTimeout(() => setGiftOpen(false), 1200); }
    } catch {
      setGiftMsg('Could not send.');
    } finally {
      setGiftBusy(false);
    }
  };

  const sendCosmeticGift = async () => {
    if (!giftCos) { setGiftMsg('Pick an item first.'); return; }
    setGiftBusy(true);
    setGiftMsg('');
    try {
      const r = await fetch('/api/economy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'giftCosmetic', to: Number(id), cosmeticId: giftCos }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setGiftMsg(d?.error || 'Could not send.');
      else { setGiftMsg(`Gifted "${d.gifted}" to ${p?.copsName || 'them'}!`); setTimeout(() => setGiftOpen(false), 1200); }
    } catch {
      setGiftMsg('Could not send.');
    } finally {
      setGiftBusy(false);
    }
  };
  const { track, statusOf } = usePresence();

  useEffect(() => {
    if (id && !Number.isNaN(Number(id))) track([Number(id)]);
  }, [track, id]);

  useEffect(() => {
    if (!id || Number.isNaN(Number(id))) { setTourneys(null); return; }
    fetch(`/api/tournaments?history=${id}`).then(r => (r.ok ? r.json() : null)).then(d => setTourneys(d)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/profile/${id}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(d => { setP(d); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setCos({ frame: null, name: null, theme: null });
    fetch(`/api/economy?player=${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(d => { if (d?.equipped) setCos(d.equipped); })
      .catch(() => {});
  }, [id]);

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <CosmeticStyles />
      <ProfileEffect theme={cos.theme} />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-10 md:py-16">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 font-bold text-gray-400 transition-colors hover:text-cyan-400">
          <ArrowLeft size={20} /> BACK TO HUB
        </Link>

        {loading && (
          <div className="flex flex-col items-center gap-4 py-24 text-cyan-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="font-bold uppercase tracking-widest">Loading profile…</p>
          </div>
        )}

        {notFound && (
          <div className="flex flex-col items-center gap-4 py-24 text-gray-400">
            <ShieldQuestion size={40} className="text-gray-600" />
            <p className="text-xl font-black">Player not found</p>
          </div>
        )}

        {p && (
          <>
            {/* Header */}
            <div className="mb-10 text-center">
              <div className="mb-4 flex justify-center">
                <div className={`rounded-full ${cos.frame ? 'p-1.5' : ''} ${frameClass(cos.frame)}`}>
                  <span
                    className="block h-24 w-24 overflow-hidden rounded-full"
                    style={{ boxShadow: `0 0 0 3px ${getTier(p.elo ?? 1000).color}, 0 0 28px -6px ${getTier(p.elo ?? 1000).color}` }}
                  >
                    {p.avatar ? (
                      <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-white/10 text-3xl font-black text-white">
                        {(p.copsName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="mb-2 flex items-center justify-center gap-2">
                <h1 className="text-5xl font-black italic tracking-tighter"><span className={nameClass(cos.name)}>{p.copsName || 'Unknown'}</span></h1>
                {p.verified ? (
                  <ShieldCheck className="text-cyan-400" size={24} />
                ) : (
                  <ShieldQuestion className="text-gray-600" size={24} />
                )}
              </div>
              <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Level {p.level ?? 0}</p>
              <div className="mt-2"><PresenceLabel status={statusOf(Number(id))} /></div>
              {tourneys && tourneys.championships > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300">
                  <Crown size={13} /> {tourneys.championships}× Champion
                </div>
              )}
              {p.supporter && (
                <div className="mt-2 ml-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/25 to-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-200">
                  <Star size={13} fill="#fbbf24" className="text-amber-400" /> Supporter
                </div>
              )}
              {clan && (
                <div className="mt-3 flex justify-center">
                  <Link
                    href={`/clans/${clan.id}`}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold transition-opacity hover:opacity-80"
                    style={{ color: clan.color || '#a78bfa', backgroundColor: `${clan.color || '#a78bfa'}1a`, border: `1px solid ${clan.color || '#a78bfa'}55` }}
                  >
                    <span className="font-black">[{clan.tag}]</span> {clan.name}
                  </Link>
                </div>
              )}
              {id && !Number.isNaN(Number(id)) && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <FriendButton accountId={Number(id)} />
                  <Link href={`/compare?a=${id}`} className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-gray-300 transition-colors hover:bg-white/5">
                    <Swords size={14} /> Compare
                  </Link>
                  <ChallengeButton targetAccountId={Number(id)} />
                  {session && (
                    <button onClick={() => { setGiftOpen(true); setGiftMsg(''); }} className="flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-500/10">
                      <Gift size={14} /> Gift
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Season medals */}
            {p.seasonMedals && p.seasonMedals.length > 0 && (
              <div className="mb-8 flex flex-wrap justify-center gap-2">
                {p.seasonMedals.map((m, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-bold text-white"
                  >
                    <span className="text-base">{m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : '🥉'}</span>
                    {m.name}
                  </span>
                ))}
              </div>
            )}

            {/* Moderation (staff only) */}
            {mod?.canModerate && (
              <div className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
                  <ShieldAlert size={15} className="text-red-400" /> Moderation <span className="text-[10px] font-bold text-gray-600">staff only</span>
                </h2>
                <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-4">
                  <div className="flex flex-wrap gap-2">
                    <select value={sancType} onChange={(e) => setSancType(e.target.value)} className="rounded-lg border border-white/10 bg-[#08080c] px-2 py-2 text-sm text-white focus:outline-none">
                      <option value="warn">Warn</option>
                      <option value="mute">Mute</option>
                      <option value="ban">Ban</option>
                      <option value="note">Note</option>
                    </select>
                    <input value={sancReason} onChange={(e) => setSancReason(e.target.value)} placeholder="Reason" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#08080c] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none" />
                    <input value={sancDur} onChange={(e) => setSancDur(e.target.value)} type="number" placeholder="hrs" title="Duration in hours (optional)" className="w-16 rounded-lg border border-white/10 bg-[#08080c] px-2 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none" />
                    <button onClick={addSanction} disabled={sancBusy || sancReason.trim().length < 2} className="rounded-lg bg-red-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-red-400 disabled:opacity-40">Add</button>
                  </div>
                  {mod.sanctions.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {mod.sanctions.map((s: any) => {
                        const color = s.type === 'ban' ? '#ef4444' : s.type === 'mute' ? '#f59e0b' : s.type === 'warn' ? '#eab308' : '#6b7280';
                        return (
                          <div key={s.id} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                            <span className="mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ color, backgroundColor: `${color}1f` }}>{s.type}{s.active ? ' · active' : ''}</span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm text-gray-200">{s.reason}</p>
                              <p className="text-[11px] text-gray-600">by {s.byName}{s.expiresAt ? ` · until ${new Date(s.expiresAt).toLocaleDateString()}` : ''}</p>
                            </div>
                            <button onClick={() => revokeSanction(s.id)} className="shrink-0 text-gray-600 hover:text-red-400" title="Revoke"><X size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gray-600">No sanctions on record.</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                    <span className="text-xs font-bold text-gray-500">Supporter:</span>
                    <button onClick={() => grantSupporter(30)} className="rounded-lg bg-amber-500/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-black hover:bg-amber-400">Grant 30d</button>
                    <button onClick={() => grantSupporter(-1)} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-gray-400 hover:text-red-400">Revoke</button>
                  </div>
                </div>
              </div>
            )}

            {/* Tournament history */}
            {tourneys && tourneys.history.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
                  <Medal size={15} className="text-amber-400" /> Tournaments
                  <span className="ml-1 font-bold text-gray-600">{tourneys.played} played · {tourneys.championships} won</span>
                </h2>
                <div className="space-y-2">
                  {tourneys.history.map((t: any) => {
                    const meta =
                      t.placement === 'champion'
                        ? { label: 'Champion', color: '#f59e0b', icon: '👑' }
                        : t.placement === 'finalist'
                        ? { label: 'Finalist', color: '#a78bfa', icon: '🥈' }
                        : t.placement === 'ongoing'
                        ? { label: 'In progress', color: '#22d3ee', icon: '⏳' }
                        : { label: 'Played', color: '#6b7280', icon: '' };
                    return (
                      <Link key={t.id} href={`/tournaments/${t.id}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 transition-colors hover:bg-white/[0.05]">
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{t.name}</span>
                        <span className="hidden shrink-0 text-[11px] text-gray-600 sm:inline">{t.participantCount} players</span>
                        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider" style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}>
                          {meta.icon} {meta.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Socials */}
            {p.socials && SOCIALS.some(s => p.socials?.[s.key]) && (
              <div className="mb-8 flex flex-wrap justify-center gap-2">
                {SOCIALS.filter(s => p.socials?.[s.key]).map(s => (
                  <a
                    key={s.key}
                    href={p.socials![s.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border px-4 py-1.5 text-sm font-bold transition-transform hover:scale-105"
                    style={{ color: s.color, borderColor: `${s.color}55`, background: `${s.color}14` }}
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}

            {/* Tier */}
            <div className="mb-8 flex justify-center">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-7 py-5">
                {(p.gamesPlayed ?? 0) < 5 ? (
                  <div className="text-center">
                    <p className="text-2xl font-black text-amber-300">Unranked</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-500">Placements · {p.gamesPlayed ?? 0}/5</p>
                    <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, ((p.gamesPlayed ?? 0) / 5) * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] text-gray-600">{5 - (p.gamesPlayed ?? 0)} more match{5 - (p.gamesPlayed ?? 0) === 1 ? '' : 'es'} to get ranked · {p.elo ?? 1000} ELO</p>
                  </div>
                ) : (
                  <TierBadge elo={p.elo ?? 1000} px={68} showName showElo showProgress />
                )}
              </div>
            </div>

            {/* Highlight match */}
            {p.highlight && (
              <Link href={`/match/${p.highlight.matchId}`} className="mb-8 block rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.08] to-transparent px-5 py-4 transition-colors hover:border-amber-500/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Star size={20} className="fill-amber-400 text-amber-400" />
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest text-amber-300">Highlight match</p>
                      <p className="text-xs text-gray-400">{p.highlight.map}{p.highlight.date ? ` · ${new Date(p.highlight.date).toLocaleDateString()}` : ''}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${p.highlight.result === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {p.highlight.result}
                  </span>
                </div>
              </Link>
            )}

            {/* Recent form */}
            {p.history && p.history.length > 0 && (
              <div className="mb-8 flex flex-col items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Recent form</p>
                <div className="flex items-center gap-1.5">
                  {[...p.history.slice(0, 5)].reverse().map((h, i) => (
                    <span
                      key={i}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${
                        h.result === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {h.result === 'win' ? 'W' : 'L'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="mb-8 flex gap-1 overflow-x-auto border-b border-white/10">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                    tab === t.id ? 'border-cyan-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {tab === 'overview' && (
              <>
                {p.h2h && (
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/[0.08] to-transparent px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Swords size={20} className="text-violet-400" />
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest text-violet-300">Head-to-head vs you</p>
                        <p className="text-xs text-gray-400">Across {p.h2h.games} match{p.h2h.games === 1 ? '' : 'es'} on opposite teams</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-black text-emerald-400">{p.h2h.wins}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">You won</p>
                      </div>
                      <span className="text-lg font-black text-gray-600">–</span>
                      <div className="text-center">
                        <p className="text-2xl font-black text-red-400">{p.h2h.losses}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">You lost</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/[0.07] p-5 text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">Rating</p>
                <p className="text-3xl font-black">{p.elo ?? 1000}</p>
                {p.peakElo != null && p.peakElo > (p.elo ?? 1000) && (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-cyan-500/70">Peak {p.peakElo}</p>
                )}
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Wins</p>
                <p className="text-3xl font-black text-emerald-400">{p.wins ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Losses</p>
                <p className="text-3xl font-black text-red-400">{p.losses ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Win%</p>
                <p className="text-3xl font-black">{p.winRate ?? 0}%</p>
              </div>
            </div>

            {/* Rating history */}
            {p.eloSeries && p.eloSeries.length > 1 && (
              <>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Rating history</h2>
                <div className="mb-10 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-2xl font-black text-cyan-400">{p.eloSeries[p.eloSeries.length - 1]}</p>
                    {(() => {
                      const net = p.eloSeries![p.eloSeries!.length - 1] - p.eloSeries![0];
                      return (
                        <p className={`text-sm font-bold ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {net > 0 ? '+' : ''}{net} over last {p.eloSeries!.length - 1} games
                        </p>
                      );
                    })()}
                  </div>
                  <EloChart series={p.eloSeries} />
                </div>
              </>
            )}

              </>
            )}

            {/* Stats tab */}
            {tab === 'stats' && p.stats && p.stats.totalMatches > 0 && (
              <>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Statistics</h2>
                <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile
                    label="Current streak"
                    value={p.stats.currentStreakType ? `${p.stats.currentStreak}${p.stats.currentStreakType}` : '—'}
                    color={p.stats.currentStreakType === 'W' ? 'text-emerald-400' : p.stats.currentStreakType === 'L' ? 'text-red-400' : 'text-white'}
                  />
                  <StatTile label="Best win streak" value={String(p.stats.longestWinStreak)} color="text-emerald-400" />
                  <StatTile label="Total matches" value={String(p.stats.totalMatches)} />
                  <StatTile
                    label="Best map"
                    value={p.stats.bestMap ? p.stats.bestMap.map : '—'}
                    sub={p.stats.bestMap ? `${p.stats.bestMap.winRate}% · ${p.stats.bestMap.games} games` : undefined}
                  />
                  {p.stats.worstMap && (
                    <StatTile
                      label="Worst map"
                      value={p.stats.worstMap.map}
                      sub={`${p.stats.worstMap.winRate}% · ${p.stats.worstMap.games} games`}
                      color="text-red-400"
                    />
                  )}
                  <StatTile
                    label="Most played"
                    value={p.stats.mostPlayedMap ? p.stats.mostPlayedMap.map : '—'}
                    sub={p.stats.mostPlayedMap ? `${p.stats.mostPlayedMap.games} games` : undefined}
                  />
                </div>

                {p.kd && (
                  <>
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Combat · K/D</h2>
                    <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                        <div>
                          <p className="text-4xl font-black text-cyan-400">{p.kd.ratio}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">K/D ratio</p>
                        </div>
                        <div className="flex flex-1 flex-wrap gap-x-6 gap-y-3">
                          {[
                            { label: 'Kills', v: p.kd.kills },
                            { label: 'Deaths', v: p.kd.deaths },
                            { label: 'Assists', v: p.kd.assists },
                            { label: 'Avg kills', v: p.kd.avgKills },
                          ].map((s) => (
                            <div key={s.label}>
                              <p className="text-2xl font-black text-white">{s.v}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="mt-4 text-[11px] text-gray-600">Across {p.kd.matches} match{p.kd.matches === 1 ? '' : 'es'} with recorded stats.</p>
                    </div>
                  </>
                )}

                {p.honor && p.honor.total > 0 && (
                  <>
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Honor</h2>
                    <div className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
                      <div className="flex items-center gap-3">
                        <ThumbsUp className="text-emerald-400" size={22} />
                        <div>
                          <p className="text-3xl font-black text-emerald-400">{p.honor.total}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Commends received</p>
                        </div>
                      </div>
                      {Object.keys(p.honor.byType).length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {Object.entries(p.honor.byType).map(([type, n]) => (
                            <span key={type} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">
                              {COMMEND_LABELS[type] || type} · {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {p.stats.mapBreakdown && p.stats.mapBreakdown.length > 1 && (
                  <>
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Map performance</h2>
                    <div className="mb-10 space-y-2">
                      {p.stats.mapBreakdown.map((m) => (
                        <div key={m.map} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                          <div className="mb-1.5 flex items-center justify-between text-sm">
                            <span className="font-bold text-white">{m.map}</span>
                            <span className="text-gray-500">
                              <span className={m.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>{m.winRate}%</span> · {m.wins}/{m.games}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className={`h-full rounded-full ${m.winRate >= 50 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${m.winRate}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Achievements tab */}
            {tab === 'achievements' && p.achievements && p.achievements.length > 0 && (
              <>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Achievements</h2>
                <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {p.achievements.map(a => {
                    const Icon = ACH_ICONS[a.id] || Award;
                    return (
                      <div
                        key={a.id}
                        title={a.desc}
                        className={`flex flex-col items-center rounded-2xl border p-4 text-center transition-colors ${
                          a.unlocked ? 'border-cyan-500/30 bg-cyan-500/[0.06]' : 'border-white/10 bg-white/[0.02] opacity-50'
                        }`}
                      >
                        <div
                          className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${
                            a.unlocked ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/5 text-gray-600'
                          }`}
                        >
                          {a.unlocked ? <Icon size={20} /> : <Lock size={16} />}
                        </div>
                        <p className={`text-xs font-black ${a.unlocked ? 'text-white' : 'text-gray-500'}`}>{a.label}</p>
                        <p className="mt-0.5 text-[10px] leading-tight text-gray-500">{a.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Matches tab */}
            {tab === 'matches' && (
              <>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">Match History</h2>
                {p.history && p.history.length > 0 ? (
              <div className="space-y-2">
                {p.history.map((h, i) => (
                  <Link
                    key={i}
                    href={`/match/${h.matchId}`}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black ${
                          h.result === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {h.result === 'win' ? 'W' : 'L'}
                      </span>
                      <div>
                        <p className="font-bold text-white">{h.map}</p>
                        <p className="text-[11px] text-gray-500">{fmtDate(h.completedAt)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-black ${h.eloDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {h.eloDelta >= 0 ? '+' : ''}{h.eloDelta}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center font-bold uppercase tracking-widest text-gray-600">
                No matches yet.
              </p>
            )}
              </>
            )}
          </>
        )}
      </div>

      {giftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setGiftOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c12] p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-white"><Gift size={18} className="text-amber-300" /> Gift to {p?.copsName || 'player'}</h2>
            <div className="mb-4 mt-3 flex gap-1 rounded-lg bg-white/[0.04] p-1">
              <button onClick={() => { setGiftTab('ep'); setGiftMsg(''); }} className={`flex-1 rounded-md py-1.5 text-xs font-black uppercase tracking-wider transition-colors ${giftTab === 'ep' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}>EP</button>
              <button onClick={() => { setGiftTab('item'); setGiftMsg(''); }} className={`flex-1 rounded-md py-1.5 text-xs font-black uppercase tracking-wider transition-colors ${giftTab === 'item' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}>Item</button>
            </div>

            {giftTab === 'ep' ? (
              <>
                <div className="flex gap-2">
                  {[50, 100, 250, 500].map((a) => (
                    <button key={a} onClick={() => setGiftAmount(String(a))} className={`flex-1 rounded-lg border py-1.5 text-xs font-black transition-colors ${Number(giftAmount) === a ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}>{a}</button>
                  ))}
                </div>
                <input type="number" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} min={10} className="mt-3 w-full rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none" />
                {giftMsg ? <p className="mt-2 text-xs font-bold text-cyan-300">{giftMsg}</p> : null}
                <button onClick={sendGift} disabled={giftBusy || Number(giftAmount) < 10} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-500 py-2.5 text-sm font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
                  {giftBusy ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />} Send {giftAmount} EP
                </button>
              </>
            ) : (
              <>
                <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                  {COSMETICS.map((c) => (
                    <button key={c.id} onClick={() => setGiftCos(c.id)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${giftCos === c.id ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{c.name}</span>
                      <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-gray-500">{c.slot}</span>
                      <span className="shrink-0 text-xs font-black text-amber-300">{c.price}</span>
                    </button>
                  ))}
                </div>
                {giftMsg ? <p className="mt-2 text-xs font-bold text-cyan-300">{giftMsg}</p> : null}
                <button onClick={sendCosmeticGift} disabled={giftBusy || !giftCos} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-500 py-2.5 text-sm font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
                  {giftBusy ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />} Gift {giftCos ? `(${getCosmetic(giftCos)?.price} EP)` : 'item'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
