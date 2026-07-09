'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Loader2, Users } from 'lucide-react';

type Info = { code: number | null; referredCount: number; earned: number; claimed: boolean; rewards: { referrer: number; referred: number } };

export default function ReferralCard() {
  const [info, setInfo] = useState<Info | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () => fetch('/api/referrals').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && !d.error) setInfo(d); }).catch(() => {});
  useEffect(() => {
    load();
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref) setCode(ref);
    } catch {
      /* ignore */
    }
  }, []);

  if (!info) return null;
  const link = typeof window !== 'undefined' && info.code != null ? `${window.location.origin}/?ref=${info.code}` : '';

  const copy = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const claim = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: Number(code) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d?.error || 'Could not claim.');
      else { setMsg(`+${d.credited} EP! Welcome bonus claimed.`); setCode(''); load(); }
    } catch {
      setMsg('Could not claim.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-1 flex items-center gap-2">
        <Users size={18} className="text-cyan-400" />
        <h3 className="font-black text-white">Refer friends</h3>
      </div>
      <p className="mb-4 text-xs text-gray-500">Share your code. When a friend joins with it, you get +{info.rewards.referrer} EP and they get +{info.rewards.referred} EP.</p>

      {info.code != null && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-[#08080c] px-3 py-2 text-sm text-gray-300">{link || `Code: ${info.code}`}</div>
            <button onClick={copy} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-2 flex gap-4 text-xs font-bold text-gray-500">
            <span>{info.referredCount} referred</span>
            <span className="text-cyan-400">{info.earned} EP earned</span>
          </div>
        </div>
      )}

      {!info.claimed ? (
        <div className="border-t border-white/5 pt-3">
          <p className="mb-2 text-xs font-bold text-gray-400">Got a friend&apos;s code? Claim your +{info.rewards.referred} EP welcome bonus:</p>
          <div className="flex items-center gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} type="number" placeholder="Friend's code" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#08080c] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none" />
            <button onClick={claim} disabled={busy || !code.trim()} className="shrink-0 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-black hover:bg-cyan-400 disabled:opacity-40">
              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Claim'}
            </button>
          </div>
          {msg ? <p className="mt-2 text-xs font-bold text-cyan-300">{msg}</p> : null}
        </div>
      ) : (
        <p className="border-t border-white/5 pt-3 text-xs text-gray-600">✓ You&apos;ve claimed a referral bonus.</p>
      )}
    </div>
  );
}
