'use client';

import { useEffect, useState, useCallback } from 'react';
import { UserPlus, UserCheck, Clock, Loader2, Check } from 'lucide-react';

type Status = 'loading' | 'hidden' | 'none' | 'outgoing' | 'incoming' | 'friends';

export default function FriendButton({ accountId }: { accountId: number }) {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [uRes, fRes] = await Promise.all([
        fetch('/api/user', { cache: 'no-store' }),
        fetch('/api/friends', { cache: 'no-store' }),
      ]);
      if (!uRes.ok) {
        setStatus('hidden');
        return;
      }
      const u = await uRes.json();
      if (u?.accountId === accountId) {
        setStatus('hidden');
        return;
      }
      const f = fRes.ok ? await fRes.json() : { friends: [], incoming: [], outgoing: [] };
      if ((f.friends || []).some((x: any) => x.accountId === accountId)) setStatus('friends');
      else if ((f.outgoing || []).some((x: any) => x.accountId === accountId)) setStatus('outgoing');
      else if ((f.incoming || []).some((x: any) => x.accountId === accountId)) setStatus('incoming');
      else setStatus('none');
    } catch {
      setStatus('hidden');
    }
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (action: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target: accountId }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading' || status === 'hidden') return null;

  const base = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50';
  const spin = busy ? <Loader2 size={15} className="animate-spin" /> : null;

  if (status === 'friends') {
    return (
      <button
        onClick={() => {
          if (window.confirm('Remove this friend?')) act('remove');
        }}
        disabled={busy}
        className={`${base} group border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300`}
      >
        {spin || <UserCheck size={15} />}
        <span className="group-hover:hidden">Friends</span>
        <span className="hidden group-hover:inline">Remove</span>
      </button>
    );
  }

  if (status === 'incoming') {
    return (
      <div className="inline-flex gap-2">
        <button onClick={() => act('accept')} disabled={busy} className={`${base} bg-cyan-500 text-black hover:bg-cyan-400`}>
          {spin || <Check size={15} />} Accept request
        </button>
        <button onClick={() => act('decline')} disabled={busy} className={`${base} border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white`}>
          Decline
        </button>
      </div>
    );
  }

  if (status === 'outgoing') {
    return (
      <button onClick={() => act('cancel')} disabled={busy} className={`${base} border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white`}>
        {spin || <Clock size={15} />} Requested
      </button>
    );
  }

  return (
    <button onClick={() => act('request')} disabled={busy} className={`${base} bg-cyan-500 text-black hover:bg-cyan-400`}>
      {spin || <UserPlus size={15} />} Add friend
    </button>
  );
}
