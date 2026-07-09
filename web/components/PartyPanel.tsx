'use client';

import { useState, useEffect } from 'react';
import { Users, Crown, X, Copy, Check, Loader2, Plus, UserPlus } from 'lucide-react';
import { CosmeticStyles, useNameStyles } from './ProfileCosmetics';

export type PartyMember = {
  discordId: string;
  accountId: number | null;
  copsName: string;
  elo: number;
  avatar: string | null;
  isLeader: boolean;
};
export type Party = {
  partyId: string;
  code: string;
  leaderId: string;
  isLeader: boolean;
  queuing: boolean;
  maxSize: number;
  members: PartyMember[];
  invited: { accountId: number | null; copsName: string; avatar: string | null }[];
};

export default function PartyPanel({
  party,
  myDiscordId,
  myImage,
  onChange,
}: {
  party: Party | null;
  myDiscordId?: string;
  myImage?: string | null;
  onChange: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<{ accountId: number | null; copsName: string; avatar: string | null }[]>([]);
  const { ensure, styleOf } = useNameStyles();

  useEffect(() => {
    ensure((party?.members || []).map((m) => m.accountId));
  }, [ensure, party?.members]);

  useEffect(() => {
    if (!party?.isLeader) return;
    fetch('/api/friends', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setFriends(d.friends || []);
      })
      .catch(() => {});
  }, [party?.isLeader, party?.members?.length, party?.invited?.length]);

  const act = async (action: string, extra?: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && d?.error) setErr(d.error);
      if (action === 'join' && res.ok) setCode('');
      onChange();
    } catch {
      setErr('Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (!party) return;
    navigator.clipboard?.writeText(party.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // ---- No party: create / join ----
  if (!party) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
          <Users size={16} /> Party
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => act('create')}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create a party
          </button>
          <div className="flex flex-1 items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ENTER CODE"
              className="w-full rounded-2xl border border-white/10 bg-[#101015] px-4 py-3 text-sm font-bold tracking-[0.2em] text-white outline-none focus:border-cyan-400/50"
            />
            <button
              onClick={() => act('join', { code })}
              disabled={busy || code.length < 4}
              className="shrink-0 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-white/[0.1] disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>
        {err ? <p className="mt-3 text-xs font-bold text-red-400">{err}</p> : null}
      </div>
    );
  }

  // ---- In a party ----
  const invited = party.invited || [];
  const slots = Math.max(0, party.maxSize - party.members.length - invited.length);
  const takenAccountIds = new Set<number>([
    ...party.members.map((m) => m.accountId).filter((x): x is number => x != null),
    ...invited.map((m) => m.accountId).filter((x): x is number => x != null),
  ]);
  const invitableFriends = friends.filter((f) => f.accountId != null && !takenAccountIds.has(f.accountId));

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-sm">
      <CosmeticStyles />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
          <Users size={16} /> Party <span className="text-white">{party.members.length}/{party.maxSize}</span>
          {party.queuing ? (
            <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" /> Searching
            </span>
          ) : null}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold tracking-widest text-gray-300 transition-colors hover:bg-white/[0.08]"
            title="Copy invite code"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="tracking-[0.2em] text-white">{party.code}</span>
          </button>
          <button
            onClick={() => act('leave')}
            disabled={busy}
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {party.members.map((m) => {
          const isMe = m.discordId === myDiscordId;
          return (
            <div
              key={m.discordId}
              className={`relative flex min-w-[120px] flex-col items-center rounded-2xl border p-4 ${
                m.isLeader ? 'border-cyan-500/30 bg-white/5' : 'border-white/10 bg-white/5'
              }`}
            >
              {m.isLeader && (
                <div className="absolute -right-2 -top-2 rounded-full bg-cyan-400 p-1 text-black shadow-[0_0_10px_rgba(34,211,238,0.6)]">
                  <Crown size={12} strokeWidth={4} />
                </div>
              )}
              {party.isLeader && !m.isLeader && (
                <button
                  onClick={() => act('kick', { targetId: m.discordId })}
                  title="Kick"
                  className="absolute -left-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-80 transition-opacity hover:opacity-100"
                >
                  <X size={11} strokeWidth={4} />
                </button>
              )}
              <div className={`mb-3 h-16 w-16 overflow-hidden rounded-xl border-2 bg-gray-700 ${m.isLeader ? 'border-cyan-400' : 'border-white/20'}`}>
                {isMe && myImage ? (
                  <img src={myImage} alt="" className="h-full w-full object-cover" />
                ) : m.avatar ? (
                  <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-500">
                    <Users size={22} />
                  </div>
                )}
              </div>
              <p className={`w-full truncate text-center text-sm font-bold ${styleOf(m.accountId)}`}>{m.copsName}</p>
              <p className="text-xs font-black text-cyan-400">{m.elo} ELO</p>
              <p className="mt-1 text-[10px] font-bold uppercase text-cyan-500">{m.isLeader ? 'Leader' : isMe ? 'You' : 'Member'}</p>
            </div>
          );
        })}

        {invited.map((m, i) => (
          <div
            key={`inv-${i}`}
            className="flex min-w-[120px] flex-col items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 opacity-80"
          >
            <div className="mb-3 h-16 w-16 overflow-hidden rounded-xl border-2 border-cyan-500/30 bg-gray-700">
              {m.avatar ? (
                <img src={m.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-500">
                  <Users size={22} />
                </div>
              )}
            </div>
            <p className="w-full truncate text-center text-sm font-bold text-gray-300">{m.copsName}</p>
            <p className="mt-1 text-[10px] font-bold uppercase text-cyan-500">Invited</p>
          </div>
        ))}

        {Array.from({ length: slots }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 opacity-60"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-black/50">
              <Users size={20} className="text-gray-500" />
            </div>
            <p className="text-[10px] font-bold uppercase text-gray-500">Share code</p>
          </div>
        ))}
      </div>

      {party.isLeader && slots > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
            <UserPlus size={13} /> Invite friends
          </p>
          {invitableFriends.length === 0 ? (
            <p className="text-xs text-gray-600">No friends to invite. Add friends, or share the code above.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {invitableFriends.map((f) => (
                <button
                  key={f.accountId}
                  onClick={() => act('invite', { target: f.accountId })}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-gray-300 transition-colors hover:bg-white/[0.08] disabled:opacity-40"
                >
                  <UserPlus size={12} className="text-cyan-400" /> {f.copsName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {err ? <p className="mt-3 text-xs font-bold text-red-400">{err}</p> : null}
      {!party.isLeader ? (
        <p className="mt-3 text-center text-[11px] text-gray-500">Only the leader can start the search.</p>
      ) : null}
    </div>
  );
}
