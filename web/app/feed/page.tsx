'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Newspaper, MapPin, Loader2, UserPlus, Trophy, RefreshCw } from 'lucide-react';
import PageBackground from '../../components/PageBackground';
import PostComposer from '../../components/PostComposer';
import PostCard, { Post } from '../../components/PostCard';

type TeamP = { copsName: string; accountId: number | null; elo: number | null; avatar: string | null };
type Item =
  | {
      kind: 'match';
      matchId: string;
      map: string;
      winner: 'A' | 'B' | null;
      at: string;
      teamA: TeamP[];
      teamB: TeamP[];
      you: boolean;
      myResult: 'win' | 'loss' | null;
      myDelta: number | null;
      friendNames: string[];
    }
  | { kind: 'friend'; at: string; name: string; accountId: number | null; avatar: string | null };

function timeAgo(s?: string) {
  if (!s) return '';
  const diff = Math.max(0, Date.now() - new Date(s).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TeamLine({ team, win }: { team: TeamP[]; win: boolean }) {
  return (
    <div className={`flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 ${win ? 'text-white' : 'text-gray-500'}`}>
      {team.map((p, i) => (
        <span key={i} className="text-sm font-bold">
          {p.accountId != null ? (
            <Link href={`/profile/${p.accountId}`} className="hover:text-cyan-400">
              {p.copsName}
            </Link>
          ) : (
            p.copsName
          )}
          {i < team.length - 1 ? <span className="text-gray-700">,</span> : null}
        </span>
      ))}
    </div>
  );
}

function MatchCard({ it }: { it: Extract<Item, { kind: 'match' }> }) {
  const aWon = it.winner === 'A';
  const bWon = it.winner === 'B';
  const context = it.you
    ? it.myResult === 'win'
      ? { text: `You won${it.myDelta != null ? ` · ${it.myDelta >= 0 ? '+' : ''}${it.myDelta} ELO` : ''}`, cls: 'text-emerald-400' }
      : { text: `You lost${it.myDelta != null ? ` · ${it.myDelta} ELO` : ''}`, cls: 'text-red-400' }
    : it.friendNames.length
    ? { text: `${it.friendNames.join(', ')} played`, cls: 'text-cyan-400' }
    : null;

  return (
    <Link href={`/match/${it.matchId}`} className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          <MapPin size={13} className="text-cyan-500" /> {it.map}
        </div>
        <span className="text-[11px] uppercase tracking-widest text-gray-600">{timeAgo(it.at)}</span>
      </div>
      <div className="flex items-center gap-3">
        <TeamLine team={it.teamA} win={aWon} />
        <span className="shrink-0 text-[11px] font-black uppercase text-gray-600">vs</span>
        <TeamLine team={it.teamB} win={bWon} />
      </div>
      {context && <p className={`mt-3 text-xs font-bold ${context.cls}`}>{context.text}</p>}
    </Link>
  );
}

function FriendCard({ it }: { it: Extract<Item, { kind: 'friend' }> }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
        <UserPlus size={16} />
      </div>
      <p className="flex-1 text-sm text-gray-200">
        You and{' '}
        {it.accountId != null ? (
          <Link href={`/profile/${it.accountId}`} className="font-black text-white hover:text-cyan-400">
            {it.name}
          </Link>
        ) : (
          <span className="font-black text-white">{it.name}</span>
        )}{' '}
        are now friends
      </p>
      <span className="text-[11px] uppercase tracking-widest text-gray-600">{timeAgo(it.at)}</span>
    </div>
  );
}

export default function FeedPage() {
  const { data: session } = useSession();
  const [view, setView] = useState<'posts' | 'activity'>('posts');

  // Posts (community wall)
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  // Activity (matches + friend events)
  const [scope, setScope] = useState<'following' | 'global'>('following');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const res = await fetch('/api/posts', { cache: 'no-store' });
      const d = res.ok ? await res.json() : { posts: [] };
      setPosts(d.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async (s: 'following' | 'global') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?scope=${s}`, { cache: 'no-store' });
      const d = res.ok ? await res.json() : { items: [] };
      setItems(d.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (view === 'activity') loadActivity(session ? scope : 'global');
  }, [view, scope, session, loadActivity]);

  useEffect(() => {
    if (!session) {
      setIsStaff(false);
      return;
    }
    fetch('/api/user')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIsStaff(['admin', 'mod'].includes(d?.staffLevel)))
      .catch(() => {});
  }, [session]);

  // Pull-to-refresh (mobile: drag down at the top to refresh the current view)
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const doRefresh = useCallback(async () => {
    if (view === 'posts') await loadPosts();
    else await loadActivity(session ? scope : 'global');
  }, [view, loadPosts, loadActivity, session, scope]);

  // Refresh when the user returns to the page (tab focus / re-entry)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') doRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [doRefresh]);

  const manualRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    doRefresh().finally(() => setRefreshing(false));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY <= 0) setPull(Math.min(80, dy * 0.5));
    else {
      pulling.current = false;
      setPull(0);
    }
  };
  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull > 50) {
      setRefreshing(true);
      setPull(48);
      await doRefresh();
      setRefreshing(false);
    }
    setPull(0);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <PageBackground />
      <div className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 transition-opacity" style={{ opacity: refreshing ? 1 : Math.min(1, pull / 50) }}>
        <div className="rounded-full bg-black/70 p-2 shadow-lg backdrop-blur">
          <Loader2 size={20} className={`text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }} />
        </div>
      </div>
      <button
        onClick={manualRefresh}
        title="Refresh feed"
        className="fixed bottom-24 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-cyan-500 text-black shadow-lg transition-colors hover:bg-cyan-400"
      >
        <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
      </button>
      <div className="relative mx-auto max-w-2xl px-6 py-10 md:py-14" style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: pulling.current ? 'none' : 'transform 0.25s ease' }}>
        <div className="mb-6">
          <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">The Feed</div>
          <h1 className="flex items-center gap-3 bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">
            Community
          </h1>
        </div>

        {/* View tabs */}
        <div className="mb-6 flex gap-1 border-b border-white/10">
          {(['posts', 'activity'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold capitalize transition-colors ${
                view === v ? 'border-cyan-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {v === 'posts' ? 'Posts' : 'Activity'}
            </button>
          ))}
        </div>

        {view === 'posts' ? (
          <>
            {session && <PostComposer isStaff={isStaff} onPosted={loadPosts} />}
            {postsLoading ? (
              <div className="flex justify-center py-20 text-cyan-400">
                <Loader2 className="animate-spin" size={28} />
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                <Newspaper size={28} className="mx-auto mb-3 text-gray-600" />
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">No posts yet</p>
                <p className="mt-2 text-xs text-gray-600">{session ? 'Be the first to post something.' : 'Sign in to post.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} onDeleted={() => loadPosts()} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {session && (
              <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
                {(['following', 'global'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`rounded-full px-4 py-1.5 text-sm font-bold capitalize transition-colors ${
                      scope === s ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {s === 'following' ? 'Following' : 'Global'}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-20 text-cyan-400">
                <Loader2 className="animate-spin" size={28} />
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                <Trophy size={28} className="mx-auto mb-3 text-gray-600" />
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">
                  {scope === 'following' ? 'Nothing here yet' : 'No recent activity'}
                </p>
                <p className="mt-2 text-xs text-gray-600">
                  {scope === 'following' ? 'Add friends and play matches to fill your feed.' : 'Completed matches will show up here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, i) =>
                  it.kind === 'match' ? <MatchCard key={`m-${it.matchId}-${i}`} it={it} /> : <FriendCard key={`f-${i}`} it={it} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
