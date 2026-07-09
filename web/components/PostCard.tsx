'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Trash2, Megaphone, ExternalLink, MessageCircle, Send, Loader2 } from 'lucide-react';
import { getTier } from '../lib/tiers';
import { MessageText } from './MessageText';

export type Post = {
  id: string;
  authorName: string;
  authorAccountId: number | null;
  authorAvatar: string | null;
  authorElo: number | null;
  text: string;
  mediaUrl: string | null;
  announcement: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  mine: boolean;
  createdAt: string;
  poll?: { options: { text: string; votes: number; mine: boolean }[]; totalVotes: number } | null;
};

type Comment = { id: string; authorName: string; authorAccountId: number | null; authorAvatar: string | null; text: string; createdAt: string; parentId: string | null; mine: boolean };

function CommentBubble({ c, onDelete }: { c: Comment; onDelete: (id: string) => void }) {
  return (
    <>
      {c.authorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.authorAvatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-black text-gray-400">{(c.authorName || '?').charAt(0).toUpperCase()}</div>
      )}
      <div className="min-w-0 flex-1 rounded-xl bg-white/[0.03] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-white">
            {c.authorAccountId != null ? (
              <Link href={`/profile/${c.authorAccountId}`} className="hover:text-cyan-400">{c.authorName}</Link>
            ) : (
              c.authorName
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-gray-600">{timeAgo(c.createdAt)}</span>
            {c.mine && (
              <button onClick={() => onDelete(c.id)} className="text-gray-600 hover:text-red-400" title="Delete">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-200"><MessageText text={c.text} /></p>
      </div>
    </>
  );
}

function timeAgo(s?: string) {
  if (!s) return '';
  const diff = Math.max(0, Date.now() - new Date(s).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Media({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  if (yt) {
    return (
      <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-white/10">
        <iframe src={`https://www.youtube.com/embed/${yt[1]}`} className="h-full w-full" allowFullScreen title="clip" />
      </div>
    );
  }
  const st = url.match(/streamable\.com\/(?:e\/)?(\w+)/);
  if (st) {
    return (
      <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-white/10">
        <iframe src={`https://streamable.com/e/${st[1]}`} className="h-full w-full" allowFullScreen title="clip" />
      </div>
    );
  }
  if (url.startsWith('/api/uploads/') || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="mt-3 max-h-[28rem] w-full rounded-xl border border-white/10 object-cover" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-cyan-300 hover:bg-white/[0.06]"
    >
      <ExternalLink size={14} /> <span className="truncate">{url}</span>
    </a>
  );
}

export default function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (id: string) => void }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likeCount);
  const [gone, setGone] = useState(false);
  const [poll, setPoll] = useState(post.poll || null);
  const tierColor = typeof post.authorElo === 'number' ? getTier(post.authorElo).color : '#22d3ee';

  const votePoll = async (option: number) => {
    if (!poll) return;
    const already = poll.options[option]?.mine;
    // optimistic single-choice update
    setPoll((prev) => {
      if (!prev) return prev;
      const options = prev.options.map((o, i) => {
        const wasMine = o.mine;
        const mine = i === option ? !already : false;
        const votes = o.votes - (wasMine ? 1 : 0) + (mine ? 1 : 0);
        return { ...o, votes, mine };
      });
      return { ...prev, options, totalVotes: options.reduce((s, o) => s + o.votes, 0) };
    });
    try {
      await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vote', id: post.id, option }) });
    } catch {
      /* ignore */
    }
  };

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', id: post.id }) });
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  };

  const del = async () => {
    if (!window.confirm('Delete this post?')) return;
    setGone(true);
    try {
      await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: post.id }) });
      onDeleted?.(post.id);
    } catch {
      setGone(false);
    }
  };

  const [showC, setShowC] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cLoaded, setCLoaded] = useState(false);
  const [cText, setCText] = useState('');
  const [cBusy, setCBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [cCount, setCCount] = useState(post.commentCount);

  if (gone) return null;

  const toggleComments = async () => {
    const next = !showC;
    setShowC(next);
    if (next && !cLoaded) {
      try {
        const res = await fetch(`/api/comments?postId=${post.id}`, { cache: 'no-store' });
        const d = res.ok ? await res.json() : { comments: [] };
        setComments(d.comments || []);
        setCLoaded(true);
      } catch {
        /* ignore */
      }
    }
  };

  const addComment = async () => {
    const text = cText.trim();
    if (!text || cBusy) return;
    setCBusy(true);
    try {
      const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', postId: post.id, text }) });
      if (res.ok) {
        setCText('');
        const r2 = await fetch(`/api/comments?postId=${post.id}`, { cache: 'no-store' });
        const d = r2.ok ? await r2.json() : { comments };
        setComments(d.comments || []);
        setCCount((n) => n + 1);
      }
    } finally {
      setCBusy(false);
    }
  };

  const submitReply = async (parentId: string) => {
    const text = replyText.trim();
    if (!text || replyBusy) return;
    setReplyBusy(true);
    try {
      const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', postId: post.id, text, parentId }) });
      if (res.ok) {
        setReplyText('');
        setReplyTo(null);
        const r2 = await fetch(`/api/comments?postId=${post.id}`, { cache: 'no-store' });
        const d = r2.ok ? await r2.json() : { comments };
        setComments(d.comments || []);
        setCCount((n) => n + 1);
      }
    } finally {
      setReplyBusy(false);
    }
  };

  const delComment = async (id: string) => {
    setComments((cs) => cs.filter((c) => c.id !== id));
    setCCount((n) => Math.max(0, n - 1));
    await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) }).catch(() => {});
  };

  return (
    <div className={`rounded-2xl border p-4 ${post.announcement ? 'border-amber-400/30 bg-amber-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
      {post.announcement && (
        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-400">
          <Megaphone size={13} /> Announcement
        </div>
      )}
      <div className="flex items-start gap-3">
        {post.authorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.authorAvatar} alt="" className="h-10 w-10 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${tierColor}55` }} />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-black" style={{ color: tierColor }}>
            {(post.authorName || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {post.authorAccountId != null ? (
                <Link href={`/profile/${post.authorAccountId}`} className="font-black text-white hover:text-cyan-400">
                  {post.authorName}
                </Link>
              ) : (
                <span className="font-black text-white">{post.authorName}</span>
              )}
              <span className="text-[11px] uppercase tracking-widest text-gray-600">{timeAgo(post.createdAt)}</span>
            </div>
            {post.mine && (
              <button onClick={del} title="Delete" className="text-gray-600 transition-colors hover:text-red-400">
                <Trash2 size={15} />
              </button>
            )}
          </div>
          {post.text && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-200"><MessageText text={post.text} /></p>}
          {post.mediaUrl && <Media url={post.mediaUrl} />}
          {poll && (
            <div className="mt-3 space-y-1.5">
              {poll.options.map((o, i) => {
                const pct = poll.totalVotes > 0 ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
                return (
                  <button
                    key={i}
                    onClick={() => votePoll(i)}
                    className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors ${o.mine ? 'border-violet-400/50' : 'border-white/10 hover:border-white/25'}`}
                  >
                    <div className="absolute inset-y-0 left-0 bg-violet-500/15" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center justify-between gap-2">
                      <span className={`truncate text-sm font-bold ${o.mine ? 'text-violet-200' : 'text-gray-200'}`}>{o.mine ? '✓ ' : ''}{o.text}</span>
                      <span className="shrink-0 text-xs font-black text-gray-400">{pct}%</span>
                    </div>
                  </button>
                );
              })}
              <p className="text-[11px] text-gray-600">{poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'} · tap to vote</p>
            </div>
          )}
          <div className="mt-3 flex items-center gap-4">
            <button onClick={toggleLike} className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${liked ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}>
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> {count > 0 ? count : ''}
            </button>
            <button onClick={toggleComments} className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${showC ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-400'}`}>
              <MessageCircle size={16} /> {cCount > 0 ? cCount : ''}
            </button>
          </div>

          {showC && (
            <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
              {(() => {
                const tops = comments.filter((c) => !c.parentId);
                const repliesByParent: Record<string, Comment[]> = {};
                for (const c of comments) if (c.parentId) (repliesByParent[c.parentId] ||= []).push(c);
                return tops.map((c) => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CommentBubble c={c} onDelete={delComment} />
                    </div>
                    <div className="ml-3">
                      <button
                        onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(''); }}
                        className="ml-6 text-[11px] font-bold text-gray-500 hover:text-cyan-400"
                      >
                        {replyTo === c.id ? 'Cancel' : 'Reply'}
                      </button>
                    </div>
                    {(repliesByParent[c.id] || []).map((r) => (
                      <div key={r.id} className="ml-9 flex items-start gap-2">
                        <CommentBubble c={r} onDelete={delComment} />
                      </div>
                    ))}
                    {replyTo === c.id && (
                      <div className="ml-9 flex items-center gap-2">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitReply(c.id); }}
                          autoFocus
                          placeholder={`Reply to ${c.authorName}…`}
                          className="flex-1 rounded-full border border-white/10 bg-[#0c0c10] px-4 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                        />
                        <button
                          onClick={() => submitReply(c.id)}
                          disabled={!replyText.trim() || replyBusy}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-black disabled:opacity-40"
                        >
                          {replyBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                ));
              })()}
              <div className="flex items-center gap-2">
                <input
                  value={cText}
                  onChange={(e) => setCText(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addComment();
                  }}
                  placeholder="Write a reply…"
                  className="flex-1 rounded-full border border-white/10 bg-[#0c0c10] px-4 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                />
                <button
                  onClick={addComment}
                  disabled={!cText.trim() || cBusy}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-black disabled:opacity-40"
                >
                  {cBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
