'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { Radar, Loader2, Send, Trash2, ArrowRight } from 'lucide-react';
import { getTier } from '../../lib/tiers';
import PageBackground from '../../components/PageBackground';

type Listing = { accountId: number | null; copsName: string; avatar: string | null; elo: number; text: string; createdAt: string | null; isMine: boolean };

function ago(iso: string | null) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function LfgPage() {
  const { data: session } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/lfg', { cache: 'no-store' });
      const d = r.ok ? await r.json() : { listings: [], mine: null };
      setListings(d.listings || []);
      setMine(d.mine || null);
      if (d.mine && !text) setText(d.mine.text || '');
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const post = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/lfg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || 'Could not post.');
      else await load();
    } catch {
      setErr('Could not post.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await fetch('/api/lfg', { method: 'DELETE' });
      setText('');
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />
      <div className="relative mx-auto max-w-2xl px-6 py-10 md:py-14">
        <div className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">Social</div>
        <h1 className="mb-1 flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">
          Looking for Team
        </h1>
        <p className="mb-6 text-sm text-gray-500">Post that you&apos;re looking to play, and find others who are too.</p>

        {/* Composer */}
        {session ? (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="e.g. Looking for 2 more for ranked, mic preferred, chill vibes"
              className="w-full resize-none rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none"
            />
            {err ? <p className="mt-2 text-xs font-bold text-red-400">{err}</p> : null}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-gray-600">{mine ? 'Your listing is live · lasts 48h' : 'Listings last 48h'}</span>
              <div className="flex items-center gap-2">
                {mine && (
                  <button onClick={remove} disabled={busy} className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                    <Trash2 size={13} /> Remove
                  </button>
                )}
                <button onClick={post} disabled={busy || text.trim().length < 2} className="flex items-center gap-1.5 rounded-full bg-cyan-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {mine ? 'Update' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
            <p className="text-sm text-gray-500">Sign in to post a listing.</p>
            <button onClick={() => signIn('discord', { callbackUrl: '/lfg' })} className="mt-3 rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-cyan-400">Connect</button>
          </div>
        )}

        {/* Listings */}
        {loading ? (
          <div className="flex justify-center py-16 text-cyan-400"><Loader2 className="animate-spin" size={26} /></div>
        ) : listings.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <Radar size={28} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm font-bold uppercase tracking-widest text-gray-500">No one is looking right now</p>
            <p className="mt-2 text-xs text-gray-600">Be the first to post.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {listings.map((l) => (
              <div key={(l.accountId ?? l.copsName) + (l.createdAt || '')} className={`rounded-2xl border p-4 ${l.isMine ? 'border-cyan-500/30 bg-cyan-500/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="flex items-center gap-3">
                  {l.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${getTier(l.elo).color}55` }} />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black" style={{ color: getTier(l.elo).color }}>{(l.copsName || '?').charAt(0).toUpperCase()}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-white">{l.copsName}</p>
                      <span className="shrink-0 text-xs font-bold" style={{ color: getTier(l.elo).color }}>{l.elo}</span>
                      {l.isMine && <span className="shrink-0 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">You</span>}
                      <span className="ml-auto shrink-0 text-[11px] text-gray-600">{ago(l.createdAt)}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-gray-300">{l.text}</p>
                  </div>
                </div>
                {!l.isMine && l.accountId != null && (
                  <div className="mt-3 flex justify-end">
                    <Link href={`/profile/${l.accountId}`} className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/5">
                      View profile <ArrowRight size={13} />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
