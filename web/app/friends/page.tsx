'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Users, UserPlus, Search, Check, X, Loader2, Clock } from 'lucide-react';
import { usePresence, PresenceDot, presenceMeta } from '../../components/Presence';
import PageBackground from '../../components/PageBackground';

type P = { accountId: number | null; copsName: string; elo: number; avatar: string | null };

function Avatar({ p, status }: { p: P; status?: string }) {
  return (
    <div className="relative">
      {p.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-black text-gray-400">
          {(p.copsName || '?').charAt(0).toUpperCase()}
        </div>
      )}
      {status && status !== 'offline' && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[#0a0a0e]">
          <PresenceDot status={status} size={11} />
        </span>
      )}
    </div>
  );
}

function Row({ p, status, children }: { p: P; status?: string; children?: React.ReactNode }) {
  const inner = (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center gap-3">
        <Avatar p={p} status={status} />
        <div>
          <p className="font-bold text-white">{p.copsName}</p>
          <p className="text-[11px] text-gray-500">{status && status !== 'offline' ? presenceMeta(status).label : `${p.elo} ELO`}</p>
        </div>
      </div>
      {children}
    </div>
  );
  return p.accountId != null ? (
    <div className="block">{children ? inner : <Link href={`/profile/${p.accountId}`}>{inner}</Link>}</div>
  ) : (
    inner
  );
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<P[]>([]);
  const [incoming, setIncoming] = useState<P[]>([]);
  const [outgoing, setOutgoing] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<P[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { track, statusOf } = usePresence();

  useEffect(() => {
    track([...friends, ...incoming, ...outgoing, ...results].map((p) => p.accountId));
  }, [track, friends, incoming, outgoing, results]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/friends', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setFriends(d.friends || []);
        setIncoming(d.incoming || []);
        setOutgoing(d.outgoing || []);
      }
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
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
        const d = res.ok ? await res.json() : { results: [] };
        setResults(d.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [q]);

  const act = async (action: string, target: number) => {
    try {
      await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target }),
      });
      await load();
    } catch {
      /* ignore */
    }
  };

  const friendIds = new Set(friends.map((f) => f.accountId));
  const outIds = new Set(outgoing.map((f) => f.accountId));
  const inIds = new Set(incoming.map((f) => f.accountId));

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <div className="relative mx-auto max-w-2xl px-6 py-10 md:py-14">
        <div className="mb-8">
          <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Social</div>
          <h1 className="flex items-center gap-3 bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">
            Friends
          </h1>
        </div>

        {/* Add friend */}
        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
            <UserPlus size={16} className="text-cyan-400" /> Add a friend
          </p>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name…"
              className="w-full rounded-xl border border-white/10 bg-[#0c0c10] py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-400/50"
            />
            {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500" />}
          </div>
          {results.length > 0 && (
            <div className="mt-3 space-y-2">
              {results.map((p) => (
                <Row key={p.accountId} p={p} status={statusOf(p.accountId)}>
                  {friendIds.has(p.accountId) ? (
                    <span className="text-xs font-bold text-emerald-400">Friends</span>
                  ) : outIds.has(p.accountId) ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                      <Clock size={13} /> Sent
                    </span>
                  ) : inIds.has(p.accountId) ? (
                    <button onClick={() => act('accept', p.accountId!)} className="rounded-full bg-cyan-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-cyan-400">
                      Accept
                    </button>
                  ) : (
                    <button onClick={() => act('request', p.accountId!)} className="flex items-center gap-1.5 rounded-full bg-cyan-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-cyan-400">
                      <UserPlus size={13} /> Add
                    </button>
                  )}
                </Row>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-cyan-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : (
          <>
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">
                  Requests <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[11px] text-cyan-300">{incoming.length}</span>
                </h2>
                <div className="space-y-2">
                  {incoming.map((p) => (
                    <Row key={p.accountId} p={p} status={statusOf(p.accountId)}>
                      <div className="flex gap-2">
                        <button onClick={() => act('accept', p.accountId!)} className="flex items-center gap-1.5 rounded-full bg-cyan-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-cyan-400">
                          <Check size={14} /> Accept
                        </button>
                        <button onClick={() => act('decline', p.accountId!)} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    </Row>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing requests */}
            {outgoing.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Pending</h2>
                <div className="space-y-2">
                  {outgoing.map((p) => (
                    <Row key={p.accountId} p={p} status={statusOf(p.accountId)}>
                      <button onClick={() => act('cancel', p.accountId!)} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white">
                        <Clock size={13} /> Cancel
                      </button>
                    </Row>
                  ))}
                </div>
              </div>
            )}

            {/* Friends */}
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">
              Your friends <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300">{friends.length}</span>
            </h2>
            {friends.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm font-bold uppercase tracking-widest text-gray-600">
                No friends yet — search above to add some.
              </p>
            ) : (
              <div className="space-y-2">
                {friends.map((p) => (
                  <Row key={p.accountId} p={p} status={statusOf(p.accountId)}>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${p.copsName}?`)) act('remove', p.accountId!);
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-gray-500 hover:border-red-500/40 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </Row>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
