'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Map as MapIcon, Swords, Loader2, ShieldQuestion, Trophy, AlertTriangle, MessageSquare, Crown } from 'lucide-react';
import { useSession } from 'next-auth/react';
import ChatBox from '../../../components/ChatBox';
import TierBadge from '../../../components/TierBadge';
import PageBackground from '../../../components/PageBackground';
import ReportPanel from '../../../components/ReportPanel';
import { CosmeticStyles, nameClass } from '../../../components/ProfileCosmetics';
import { MAP_POOL } from '../../../lib/maps';

type TeamPlayer = { discordId: string; copsName?: string; elo?: number; avatar?: string | null; accountId?: number | null; nameStyle?: string | null; stats?: { k: number; d: number; a: number } | null };
type Change = { discordId: string; copsName?: string; oldElo: number; newElo: number; delta: number; won: boolean; epEarned?: number };
type MatchData = {
  matchId: string;
  map: string;
  status: string;
  winner?: 'A' | 'B';
  teamA: TeamPlayer[];
  teamB: TeamPlayer[];
  pool?: TeamPlayer[];
  pickTurn?: 'A' | 'B' | null;
  vetoTurn?: 'A' | 'B' | null;
  mapPool?: string[];
  bannedMaps?: { map: string; by: 'A' | 'B' }[];
  result?: { winner: 'A' | 'B'; changes: Change[] };
  roomName?: string;
  roomPassword?: string;
};

function PlayerCard({ player }: { player: TeamPlayer }) {
  const s = player.stats;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
      <span className={`font-bold text-white ${nameClass(player.nameStyle)}`}>{player.copsName || 'Unknown'}</span>
      <div className="flex items-center gap-3">
        {s && (
          <span className="text-xs font-black text-gray-300">
            {s.k}<span className="text-gray-600">/</span>{s.d}<span className="text-gray-600">/</span>{s.a}
            <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">K/D/A</span>
          </span>
        )}
        <span className="text-sm font-black text-cyan-400">
          {player.elo ?? '—'} <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-600">elo</span>
        </span>
      </div>
    </div>
  );
}

function TeamColumn({ label, players, accent }: { label: string; players: TeamPlayer[]; accent: string }) {
  return (
    <div className="flex-1">
      <h2 className={`mb-4 text-center text-lg font-black uppercase tracking-[0.2em] ${accent}`}>{label}</h2>
      <div className="space-y-3">
        {players.length > 0 ? (
          players.map((p, i) => <PlayerCard key={i} player={p} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-4 text-center text-sm font-bold uppercase tracking-widest text-gray-600">
            Waiting for opponent…
          </div>
        )}
      </div>
    </div>
  );
}

function DraftSlot({ player, captain }: { player?: TeamPlayer; captain?: boolean }) {
  if (!player) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-gray-700">
        Empty
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2">
        {captain && <Crown size={13} className="shrink-0 text-yellow-400" />}
        <span className={`truncate text-sm font-bold text-white ${nameClass(player.nameStyle)}`}>{player.copsName || 'Unknown'}</span>
      </span>
      <span className="text-xs font-black text-cyan-400">{player.elo ?? ''}</span>
    </div>
  );
}

function DraftTeam({ label, players, size, accent, picking }: { label: string; players: TeamPlayer[]; size: number; accent: string; picking: boolean }) {
  const slots = Array.from({ length: size }, (_, i) => players[i]);
  return (
    <div className={`rounded-3xl border p-4 ${picking ? 'border-cyan-500/40 bg-cyan-500/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
      <h3 className={`mb-3 text-center text-sm font-black uppercase tracking-[0.2em] ${accent}`}>{label}</h3>
      <div className="space-y-2">
        {slots.map((p, i) => <DraftSlot key={i} player={p} captain={i === 0} />)}
      </div>
    </div>
  );
}

export default function MatchPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const { data: session } = useSession();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [picking, setPicking] = useState(false);
  const [mvp, setMvp] = useState<{ votes: Record<string, number>; mvp: { accountId: number; count: number } | null; myVote: number | null; eligible: boolean; totalVotes: number } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/match/${id}`, { cache: 'no-store' });
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      setMatch(await res.json());
      setLoading(false);
    } catch {
      setNotFound(true);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Keep refreshing until the match is finished (and through the draft).
  useEffect(() => {
    if (match?.status !== 'ongoing' && match?.status !== 'pending_review' && match?.status !== 'drafting' && match?.status !== 'veto') return;
    const t = setInterval(load, match?.status === 'drafting' || match?.status === 'veto' ? 2500 : 4000);
    return () => clearInterval(t);
  }, [match?.status, load]);

  const live = match?.status === 'ongoing' || match?.status === 'pending_review';

  const loadMvp = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/match/${id}/mvp`, { cache: 'no-store' });
      if (r.ok) setMvp(await r.json());
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    if (match?.status === 'completed') loadMvp();
  }, [match?.status, loadMvp]);

  const voteMvp = async (accountId: number) => {
    try {
      const r = await fetch(`/api/match/${id}/mvp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ votedFor: accountId }) });
      if (r.ok) loadMvp();
    } catch {
      /* ignore */
    }
  };

  const [dodging, setDodging] = useState(false);

  const dodgeMatch = async () => {
    if (!window.confirm('Leave the match? This cancels it for everyone and gives you a queue cooldown (it escalates if you keep doing it).')) return;
    setDodging(true);
    try {
      const r = await fetch(`/api/match/${id}/dodge`, { method: 'POST' });
      if (r.ok) {
        window.location.href = '/';
      } else {
        const d = await r.json().catch(() => ({}));
        alert(d?.error || 'Could not leave.');
        setDodging(false);
      }
    } catch {
      setDodging(false);
    }
  };

  // Draft: figure out whether the viewer is one of the two captains and whether it's their turn.
  const myId = (session?.user as any)?.discordId as string | undefined;
  const capA = match?.teamA?.[0]?.discordId;
  const capB = match?.teamB?.[0]?.discordId;
  const myTeam: 'A' | 'B' | null = myId && capA === myId ? 'A' : myId && capB === myId ? 'B' : null;
  const allParticipants = [...(match?.teamA || []), ...(match?.teamB || []), ...(match?.pool || [])];
  const isParticipant = !!myId && allParticipants.some((p) => p.discordId === myId);
  const otherPlayers = allParticipants.filter((p) => p.discordId !== myId).map((p) => ({ discordId: p.discordId, copsName: p.copsName }));
  const myTurn = !!myTeam && match?.pickTurn === myTeam;
  const draftTeamSize = Math.max(1, Math.ceil(((match?.teamA?.length || 0) + (match?.teamB?.length || 0) + (match?.pool?.length || 0)) / 2));

  const pick = async (playerId: string) => {
    if (picking) return;
    setPicking(true);
    try {
      await fetch(`/api/match/${id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      await load();
    } finally {
      setPicking(false);
    }
  };

  const banMap = async (map: string) => {
    if (picking) return;
    setPicking(true);
    try {
      await fetch(`/api/match/${id}/veto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map }),
      });
      await load();
    } finally {
      setPicking(false);
    }
  };

  const myVetoTurn = !!myTeam && match?.vetoTurn === myTeam;

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <CosmeticStyles />

      <div className="relative mx-auto max-w-4xl px-6 py-10 md:py-16">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 font-bold text-gray-400 transition-colors hover:text-cyan-400">
          <ArrowLeft size={20} /> BACK TO HUB
        </Link>

        {loading && (
          <div className="flex flex-col items-center gap-4 py-24 text-cyan-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="font-bold uppercase tracking-widest">Loading match…</p>
          </div>
        )}

        {notFound && (
          <div className="flex flex-col items-center gap-4 py-24 text-gray-400">
            <ShieldQuestion size={40} className="text-gray-600" />
            <p className="text-xl font-black">Match not found</p>
            <p className="text-sm text-gray-500">This match doesn&apos;t exist or has expired.</p>
          </div>
        )}

        {match && (
          <>
            <div className="mb-2 text-center text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Match</div>
            <h1 className="mb-8 text-center text-5xl font-black italic tracking-tighter">#{match.matchId}</h1>

            <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
              {match.map && match.status !== 'drafting' && match.status !== 'veto' && (
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-300">
                  <MapIcon size={16} /> {match.map}
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-300">
                {String(match.status).replace('_', ' ')}
              </span>
            </div>

            {/* Draft room (captains picking) */}
            {match.status === 'drafting' && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Captains drafting · coin flip decided the first pick</p>
                  <p className="mt-1 text-xl font-black">
                    <span className={match.pickTurn === 'A' ? 'text-cyan-400' : 'text-fuchsia-400'}>Team {match.pickTurn}</span>
                    <span className="text-gray-400"> is picking…</span>
                  </p>
                  {myTeam && (
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color: myTurn ? '#34d399' : '#6b7280' }}>
                      {myTurn ? 'Your pick — choose a player below' : `You are captain ${myTeam} · waiting`}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DraftTeam label="Team A" players={match.teamA || []} size={draftTeamSize} accent="text-cyan-400" picking={match.pickTurn === 'A'} />
                  <DraftTeam label="Team B" players={match.teamB || []} size={draftTeamSize} accent="text-fuchsia-400" picking={match.pickTurn === 'B'} />
                </div>

                <div>
                  <p className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Available players</p>
                  {(match.pool || []).length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-center font-bold uppercase tracking-widest text-gray-600">
                      Draft complete — starting match…
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(match.pool || []).map((p, i) => (
                        <button
                          key={i}
                          onClick={() => myTurn && pick(p.discordId)}
                          disabled={!myTurn || picking}
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                            myTurn
                              ? 'cursor-pointer border-cyan-500/40 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.12]'
                              : 'cursor-default border-white/10 bg-white/[0.03] opacity-80'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <TierBadge elo={p.elo ?? 1000} px={22} />
                            <span className="truncate font-bold text-white">{p.copsName || 'Unknown'}</span>
                          </span>
                          {myTurn && <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Pick</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {match.status !== 'drafting' && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm md:p-10">
                <div className="flex flex-col items-stretch gap-8 md:flex-row md:items-start">
                  <TeamColumn label="Team A" players={match.teamA || []} accent="text-cyan-400" />
                  <div className="flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400">
                      <Swords size={20} />
                    </div>
                  </div>
                  <TeamColumn label="Team B" players={match.teamB || []} accent="text-fuchsia-400" />
                </div>
              </div>
            )}

            {/* MVP voting (after the match) */}
            {match.status === 'completed' && (
              <div className="mt-8 rounded-3xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Crown className="text-amber-400" size={20} />
                  <h3 className="text-lg font-black text-white">MVP</h3>
                  {mvp && mvp.totalVotes > 0 ? (
                    <span className="ml-auto text-xs font-bold uppercase tracking-widest text-amber-400/80">{mvp.totalVotes} vote{mvp.totalVotes === 1 ? '' : 's'}</span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {[...(match.teamA || []), ...(match.teamB || [])].map((p) => {
                    const acc = p.accountId ?? -1;
                    const count = mvp?.votes?.[String(acc)] || 0;
                    const isTop = mvp?.mvp?.accountId != null && acc === mvp.mvp.accountId && count > 0;
                    const mine = mvp?.myVote === acc && acc >= 0;
                    return (
                      <button
                        key={p.discordId}
                        onClick={() => mvp?.eligible && acc >= 0 && voteMvp(acc)}
                        disabled={!mvp?.eligible || acc < 0}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${isTop ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-white/[0.03]'} ${mvp?.eligible ? 'hover:bg-white/[0.06]' : 'cursor-default'} ${mine ? 'ring-1 ring-cyan-500/50' : ''}`}
                      >
                        {isTop ? <Crown size={15} className="shrink-0 text-amber-400" /> : <span className="w-[15px] shrink-0" />}
                        <span className={`min-w-0 flex-1 truncate text-sm font-bold text-white ${nameClass(p.nameStyle)}`}>{p.copsName || 'Unknown'}</span>
                        {mine && <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-cyan-400">Your vote</span>}
                        <span className="shrink-0 text-sm font-black text-amber-300">{count}</span>
                      </button>
                    );
                  })}
                </div>
                {mvp?.eligible ? (
                  <p className="mt-3 text-xs text-gray-500">Tap a player to vote for the MVP — you can change your vote.</p>
                ) : mvp ? (
                  <p className="mt-3 text-xs text-gray-500">Only players in this match can vote.</p>
                ) : null}
              </div>
            )}

            {/* Live: reporting happens on Discord */}
            {live && (
              <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl border border-cyan-500/20 bg-cyan-500/[0.05] p-6 text-center">
                <MessageSquare className="shrink-0 text-cyan-400" size={20} />
                <p className="font-bold text-cyan-200">
                  Report the result in your match&apos;s private Discord channel. An admin will confirm it.
                </p>
              </div>
            )}

            {/* Result */}
            {/* Map veto (captains banning) */}
            {match.status === 'veto' && (
              <div className="mb-10">
                <div className="mb-6 text-center">
                  <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Map Veto</div>
                  {(match.mapPool?.length || 0) > 1 ? (
                    <p className="text-2xl font-black">
                      <span className={match.vetoTurn === 'A' ? 'text-cyan-400' : 'text-fuchsia-400'}>Team {match.vetoTurn}</span>{' '}
                      <span className="text-gray-300">is banning</span>
                    </p>
                  ) : (
                    <p className="text-2xl font-black text-emerald-400">Veto complete</p>
                  )}
                  {myVetoTurn && (match.mapPool?.length || 0) > 1 ? (
                    <p className="mt-2 text-sm font-bold text-cyan-300">Your turn — tap a map to ban it</p>
                  ) : myTeam && (match.mapPool?.length || 0) > 1 ? (
                    <p className="mt-2 text-sm text-gray-500">Waiting for the other captain…</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {MAP_POOL.map((mapName) => {
                    const banned = (match.bannedMaps || []).find((b) => b.map === mapName);
                    const isLast = (match.mapPool?.length || 0) === 1 && (match.mapPool || [])[0] === mapName;
                    const canBan = myVetoTurn && !banned && !isLast && (match.mapPool?.length || 0) > 1;
                    return (
                      <button
                        key={mapName}
                        disabled={!canBan || picking}
                        onClick={() => canBan && banMap(mapName)}
                        className={`relative flex h-24 items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                          isLast
                            ? 'border-emerald-400/60 bg-emerald-500/15 shadow-[0_0_25px_-5px_rgba(16,185,129,0.5)]'
                            : banned
                            ? 'border-white/5 bg-white/[0.02] opacity-40'
                            : canBan
                            ? 'cursor-pointer border-white/15 bg-white/[0.05] hover:border-red-400/60 hover:bg-red-500/10'
                            : 'border-white/10 bg-white/[0.03]'
                        }`}
                      >
                        <span
                          className={`text-sm font-black uppercase tracking-wide ${
                            isLast ? 'text-emerald-300' : banned ? 'text-gray-600 line-through' : 'text-white'
                          }`}
                        >
                          {mapName}
                        </span>
                        {banned && (
                          <span
                            className={`absolute right-2 top-2 text-[9px] font-black uppercase ${
                              banned.by === 'A' ? 'text-cyan-500' : 'text-fuchsia-500'
                            }`}
                          >
                            ✕ {banned.by}
                          </span>
                        )}
                        {isLast && (
                          <span className="absolute right-2 top-2 text-[9px] font-black uppercase text-emerald-400">Picked</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-center gap-6 text-xs font-bold uppercase tracking-widest">
                  <span className="text-cyan-400">A · {match.teamA?.[0]?.copsName || '—'}</span>
                  <span className="text-gray-600">vs</span>
                  <span className="text-fuchsia-400">B · {match.teamB?.[0]?.copsName || '—'}</span>
                </div>
              </div>
            )}

            {match.status === 'completed' && (
              <div className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.05] p-6 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-center gap-2">
                  <Trophy className="text-yellow-400" size={20} />
                  <p className="text-lg font-black uppercase tracking-widest">Team {match.winner} won</p>
                </div>
                {match.result?.changes && match.result.changes.length > 0 && (
                  <div className="mx-auto max-w-md space-y-2">
                    {match.result.changes.map((c, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2">
                        <span className="font-bold text-white">{c.copsName || 'Unknown'}</span>
                        <span className="text-sm font-bold">
                          <span className="text-gray-400">{c.oldElo}</span>
                          <span className="text-gray-600"> → </span>
                          <span className="text-cyan-400">{c.newElo}</span>
                          <span className={`ml-2 ${c.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ({c.delta >= 0 ? '+' : ''}{c.delta})
                          </span>
                          {typeof c.epEarned === 'number' && <span className="ml-2 text-amber-300">+{c.epEarned} EP</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Disputed */}
            {(match.status === 'drafting' || match.status === 'veto') && myTeam && (
              <div className="mt-4 text-center">
                <button onClick={dodgeMatch} disabled={dodging} className="text-xs font-bold text-gray-600 transition-colors hover:text-red-400 disabled:opacity-50">
                  {dodging ? 'Leaving…' : 'Leave match'}
                </button>
                <p className="mt-1 text-[10px] text-gray-700">Leaving cancels the match for everyone and applies a short queue cooldown.</p>
              </div>
            )}

            {match.status === 'disputed' && (
              <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
                <AlertTriangle className="text-amber-400" size={20} />
                <p className="font-bold text-amber-300">Reports conflict — an admin will resolve this in the Discord channel.</p>
              </div>
            )}

            {/* Cancelled */}
            {match.status === 'cancelled' && (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="font-bold uppercase tracking-widest text-gray-500">This match was cancelled.</p>
              </div>
            )}

            {/* Custom room (in-game) — shown while the match is live */}
            {match.roomName && match.status !== 'completed' && match.status !== 'cancelled' && match.status !== 'drafting' && (
              <div className="mt-8 rounded-3xl border border-cyan-500/20 bg-cyan-500/[0.05] p-6 text-center">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-cyan-500">In-Game Custom Room</p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-10">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Room name</p>
                    <p className="text-2xl font-black text-white">{match.roomName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Password</p>
                    <p className="text-2xl font-black text-cyan-300">{match.roomPassword || '—'}</p>
                  </div>
                </div>
                {match.teamA?.[0]?.copsName && (
                  <p className="mt-4 text-sm text-gray-400">
                    <span className="font-bold text-white">{match.teamA[0].copsName}</span> (host) creates the room — everyone else joins it.
                  </p>
                )}
              </div>
            )}

            {/* Match chat (players + staff) */}
            <div className="mt-8">
              <ChatBox scope={id} title="Match Chat" heightClass="h-72" />
            </div>

            {/* Report a player — for any participant (the panel hides itself if there's no one to report) */}
            {isParticipant && <ReportPanel matchId={id} players={otherPlayers} />}
          </>
        )}
      </div>
    </div>
  );
}
