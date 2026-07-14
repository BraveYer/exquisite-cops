'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Swords, Map as MapIcon } from 'lucide-react';
import TierBadge from '../components/TierBadge';
import { MAPS } from '../lib/maps';
import OnlineNow from '../components/OnlineNow';
import ChatBox from '../components/ChatBox';
import SeasonBanner from '../components/SeasonBanner';
import LandingPage from '../components/LandingPage';
import PartyPanel, { Party } from '../components/PartyPanel';
import DailyStreakCard from '../components/DailyStreakCard';
import OnboardingChecklist from '../components/OnboardingChecklist';
import { getTier } from '../lib/tiers';

const MATCH_SIZE = 10; // keep in sync with the bot's MAX_PLAYERS (5v5)

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const myDiscordId = (session?.user as any)?.discordId as string | undefined;

  const [elo, setElo] = useState<number | string | null>(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, winRate: 0 });
  const [copsName, setCopsName] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [staffLevel, setStaffLevel] = useState<string | null>(null);

  const [searching, setSearching] = useState(false);
  const [mmOn, setMmOn] = useState(true);
  const [waitSec, setWaitSec] = useState<number | null | undefined>(undefined);
  const [topMap, setTopMap] = useState<{ map: string; votes: number } | null>(null);
  const [mapPrefs, setMapPrefs] = useState<string[]>([]);

  useEffect(() => {
    try {
      const s = localStorage.getItem('exq_map_prefs');
      if (s) setMapPrefs(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMap = (m: string) =>
    setMapPrefs((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m];
      try {
        localStorage.setItem('exq_map_prefs', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  const [queueCount, setQueueCount] = useState(0);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [party, setParty] = useState<Party | null>(null);
  const [partyInvites, setPartyInvites] = useState<{ partyId: string; code: string; leaderName: string; members: number; maxSize: number }[]>([]);
  const partyRef = useRef<Party | null>(null);
  useEffect(() => {
    partyRef.current = party;
  }, [party]);

  const loadParty = () => {
    fetch('/api/party', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setParty(d.party || null);
          setPartyInvites(d.invites || []);
        }
      })
      .catch(() => {});
  };

  const inParty = !!party;
  const isLeader = !!party?.isLeader;
  const effSearching = inParty ? !!party?.queuing : searching;

  // Load profile + restore queue/match state
  useEffect(() => {
    if (!session) return;
    let active = true;

    fetch('/api/user')
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        setElo(d.elo);
        setStats({ wins: d.wins ?? 0, losses: d.losses ?? 0, winRate: d.winRate ?? 0 });
        setCopsName(d.copsName ?? null);
        setAccountId(d.accountId ?? null);
        setStaffLevel(d.staffLevel ?? null);
      })
      .catch(() => { if (active) setElo('—'); });

    fetch('/api/queue')
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        setQueueCount(d?.count ?? 0);
        if (myDiscordId && Array.isArray(d?.players) && d.players.some((p: any) => p.discordId === myDiscordId)) {
          setSearching(true);
        }
      })
      .catch(() => {});

    fetch('/api/match/current', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (active && d?.matchId) setCurrentMatchId(d.matchId); })
      .catch(() => {});

    return () => { active = false; };
  }, [session, myDiscordId]);

  // Poll queue count + auto-redirect when a match is found
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const q = await fetch('/api/queue').then(r => r.json());
        if (!cancelled && q?.count != null) setQueueCount(q.count);

        const m = await fetch('/api/match/current', { cache: 'no-store' }).then(r => r.json());
        if (cancelled) return;
        if (m?.matchId) {
          if (searching || partyRef.current?.queuing) {
            setSearching(false);
            router.push(`/match/${m.matchId}`);
            return;
          }
          setCurrentMatchId(m.matchId);
        } else {
          setCurrentMatchId(null);
        }
      } catch {}
    };

    const interval = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [session, searching, router]);

  // Heartbeat while searching so the queue knows we're still here (2-min TTL otherwise).
  useEffect(() => {
    if (!session || (!searching && !party?.queuing)) return;
    const hb = setInterval(() => {
      fetch('/api/queue', { method: 'POST', body: JSON.stringify({ action: 'heartbeat' }) }).catch(() => {});
    }, 30000);
    return () => clearInterval(hb);
  }, [session, searching, party?.queuing]);

  // Feature flag: matchmaking on/off (admin-controlled)
  useEffect(() => {
    fetch('/api/flags').then(r => (r.ok ? r.json() : null)).then(d => { if (d) setMmOn(d.flags?.matchmaking !== false); }).catch(() => {});
  }, []);

  // Estimated queue wait time
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const load = () => fetch('/api/queue/estimate').then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d) { setWaitSec(d.estimateSeconds); setTopMap(d.topMap || null); } }).catch(() => {});
    load();
    const iv = setInterval(load, 20000);
    return () => { alive = false; clearInterval(iv); };
  }, [session]);

  // Keep party state fresh (members joining/leaving, invites, search state).
  useEffect(() => {
    if (!session) return;
    loadParty();
    const t = setInterval(loadParty, 4000);
    return () => clearInterval(t);
  }, [session]);

  const toggleQueue = async () => {
    setNotice(null);
    if (!mmOn && !effSearching) {
      setNotice('Matchmaking is temporarily offline.');
      return;
    }

    // In a party, the leader controls a shared search for all members.
    if (inParty) {
      if (!isLeader) {
        setNotice('Only the party leader can start the search.');
        return;
      }
      const action = party?.queuing ? 'unqueue' : 'queue';
      try {
        const res = await fetch('/api/party', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok && d?.error) setNotice(d.error);
      } catch {
        setNotice('Network error. Please try again.');
      }
      loadParty();
      return;
    }

    if (searching) {
      setSearching(false);
      fetch('/api/queue', { method: 'POST', body: JSON.stringify({ action: 'leave' }) }).catch(() => {});
      return;
    }
    setSearching(true);
    try {
      const res = await fetch('/api/queue', { method: 'POST', body: JSON.stringify({ action: 'join', mapPrefs }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSearching(false);
        // Already in a live match -> send them straight to it.
        if (res.status === 409 && d?.matchId) {
          router.push(`/match/${d.matchId}`);
          return;
        }
        setNotice(d?.error || 'Could not join the queue.');
      }
    } catch {
      setSearching(false);
      setNotice('Network error. Please try again.');
    }
  };

  if (status !== 'loading' && !session) {
    return <LandingPage />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070709] text-white selection:bg-cyan-500/40">
      {/* Background: atmospheric glows + grid + grain */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(55% 45% at 50% -8%, rgba(34,211,238,0.20), transparent 60%), radial-gradient(45% 45% at 85% 6%, rgba(139,92,246,0.17), transparent 60%), radial-gradient(45% 50% at 10% 35%, rgba(34,211,238,0.07), transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '54px 54px',
          maskImage: 'radial-gradient(80% 60% at 50% 0%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(80% 60% at 50% 0%, black, transparent 80%)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative">

        <main className="mx-auto max-w-6xl px-6 pb-24">
          <SeasonBanner />
          {/* Ongoing-match banner */}
          {session && currentMatchId && !searching && (
            <div className="mt-6">
              <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-orange-600/10 p-4 backdrop-blur-md sm:flex-row">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400">You have an ongoing match!</p>
                </div>
                <button
                  onClick={() => router.push(`/match/${currentMatchId}`)}
                  className="rounded-xl bg-amber-500 px-6 py-2 text-xs font-black uppercase text-black transition-all hover:bg-amber-400"
                >
                  Return to Match
                </button>
              </div>
            </div>
          )}

          {/* Hero */}
          <div className="relative pt-16 text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              Live System Connected
            </div>

            <h2 className="mb-5 text-6xl font-black tracking-tighter md:text-8xl">
              CRITICAL OPS <br />
              <span
                className="bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 bg-clip-text uppercase text-transparent"
                style={{ filter: 'drop-shadow(0 6px 34px rgba(34,211,238,0.4))' }}
              >
                Ranked Hub
              </span>
            </h2>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-gray-500">
              Competitive Critical Ops · 5v5 Ranked
            </p>
          </div>

          {session ? (
            <>
              {/* Stats */}
              <div className="mx-auto mt-12 mb-12 grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-3">
                <div className="group rounded-3xl border border-cyan-500/40 bg-gradient-to-b from-cyan-500/[0.12] to-cyan-500/[0.02] p-6 shadow-[0_0_50px_-12px_rgba(34,211,238,0.5)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_64px_-10px_rgba(34,211,238,0.6)]">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">Rating</p>
                  <div className="flex items-center gap-3">
                    <p className="text-5xl font-black text-white">{elo ?? '…'}</p>
                    {typeof elo === 'number' && <TierBadge elo={elo} px={44} />}
                  </div>
                  {typeof elo === 'number' && (
                    <p className="mt-2 text-xs font-bold uppercase tracking-widest" style={{ color: getTier(elo).color }}>
                      {getTier(elo).name}
                    </p>
                  )}
                </div>
                <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.015] p-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_14px_50px_-15px_rgba(34,211,238,0.2)]">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Combat History</p>
                  <div className="flex h-full items-center justify-center gap-6 pb-4">
                    <div className="text-center">
                      <p className="text-3xl font-black text-emerald-400">{stats.wins}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-gray-500">Wins</p>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="text-center">
                      <p className="text-3xl font-black text-red-400">{stats.losses}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-gray-500">Losses</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.015] p-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_14px_50px_-15px_rgba(139,92,246,0.2)]">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Efficiency</p>
                  <p className="text-5xl font-black text-white">
                    {stats.winRate}
                    <span className="text-2xl text-gray-400">%</span>
                  </p>
                </div>
              </div>

              {/* Getting started checklist (new users) */}
              <OnboardingChecklist />

              {/* Daily streak */}
              <div className="mb-8">
                <DailyStreakCard />
              </div>

              {/* Search button */}
              <div className="mb-16 flex flex-col items-center gap-4">
                <button
                  onClick={toggleQueue}
                  disabled={(inParty && !isLeader) || (!mmOn && !effSearching)}
                  className={`w-full max-w-md transform rounded-2xl px-12 py-5 text-xl font-black text-black transition-all hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60 ${
                    effSearching
                      ? 'bg-red-500 shadow-[0_0_40px_-6px_rgba(239,68,68,0.6)] hover:bg-red-400'
                      : 'bg-cyan-400 shadow-[0_0_40px_-6px_rgba(34,211,238,0.6)] hover:bg-cyan-300'
                  }`}
                >
                  {!mmOn && !effSearching
                    ? 'MATCHMAKING OFFLINE'
                    : inParty && !isLeader
                    ? effSearching
                      ? 'SEARCHING WITH PARTY…'
                      : 'WAITING FOR LEADER'
                    : effSearching
                    ? 'CANCEL SEARCH'
                    : inParty
                    ? 'START SEARCHING (PARTY)'
                    : 'START SEARCHING MATCH'}
                </button>

                {!mmOn && !effSearching ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-300">
                    Matchmaking is temporarily offline for maintenance.
                  </p>
                ) : effSearching ? (
                  <div className="flex animate-pulse items-center gap-2 text-sm font-bold uppercase tracking-widest text-cyan-400">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    Searching for match… {queueCount} / {MATCH_SIZE}
                  </div>
                ) : (
                  <p className="text-sm font-bold uppercase tracking-widest text-gray-500">
                    Players in queue: <span className="text-gray-300">{queueCount}</span> / {MATCH_SIZE}
                  </p>
                )}

                {mmOn && waitSec !== undefined && (
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
                    Est. wait: <span className="text-gray-400">{waitSec === null ? 'depends on traffic' : waitSec < 60 ? '< 1 min' : `~${Math.round(waitSec / 60)} min`}</span>
                  </p>
                )}

                {mmOn && topMap && (
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
                    Most wanted: <span className="text-cyan-400">{topMap.map}</span>
                  </p>
                )}

                {mmOn && !effSearching && (
                  <div className="flex max-w-md flex-wrap items-center justify-center gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-gray-600"><MapIcon size={12} /> Prefer:</span>
                    {MAPS.map((m) => (
                      <button
                        key={m}
                        onClick={() => toggleMap(m)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${mapPrefs.includes(m) ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200' : 'border-white/10 text-gray-500 hover:text-white'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}

                {notice && (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
                    {notice}
                  </p>
                )}
              </div>

              {/* Pending party invites */}
              {!party && partyInvites.length > 0 && (
                <div className="mx-auto mb-4 max-w-3xl space-y-2">
                  {partyInvites.map((inv) => (
                    <div
                      key={inv.partyId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.06] px-5 py-3"
                    >
                      <p className="text-sm text-gray-200">
                        <span className="font-black text-white">{inv.leaderName}</span> invited you to their party{' '}
                        <span className="text-gray-500">
                          ({inv.members}/{inv.maxSize})
                        </span>
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await fetch('/api/party', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'acceptInvite', partyId: inv.partyId }),
                            });
                            loadParty();
                          }}
                          className="rounded-full bg-cyan-500 px-4 py-1.5 text-xs font-bold text-black hover:bg-cyan-400"
                        >
                          Accept
                        </button>
                        <button
                          onClick={async () => {
                            await fetch('/api/party', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'declineInvite', partyId: inv.partyId }),
                            });
                            loadParty();
                          }}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-bold text-gray-400 hover:text-white"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Party */}
              <PartyPanel party={party} myDiscordId={myDiscordId} myImage={session.user?.image} onChange={loadParty} />
            </>
          ) : (
            /* Logged-out CTA */
            <div className="mx-auto mt-8 max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur-sm">
              <Swords className="mx-auto mb-4 text-cyan-400" size={32} />
              <p className="mb-6 font-bold uppercase tracking-widest text-gray-400">Sign in to enter the ranked queue</p>
              <button
                onClick={() => signIn('discord', { callbackUrl: '/' })}
                className="w-full transform rounded-2xl bg-cyan-400 px-8 py-4 text-lg font-black text-black shadow-[0_0_40px_-6px_rgba(34,211,238,0.6)] transition-all hover:scale-[1.03] hover:bg-cyan-300"
              >
                CONNECT WITH DISCORD
              </button>
            </div>
          )}

          <OnlineNow />

          <div className="mt-8">
            <ChatBox scope="lobby" title="Lobby Chat" heightClass="h-72" />
          </div>
        </main>
      </div>
    </div>
  );
}
