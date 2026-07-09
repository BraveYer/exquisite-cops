'use client';

import { useEffect, useState } from 'react';
import { Star, Loader2, Check } from 'lucide-react';

type Sup = { active: boolean; until: string | null; claimable: boolean; costEp: number; monthlyEp: number };

export default function SupporterCard({ onChange }: { onChange?: () => void }) {
  const [sup, setSup] = useState<Sup | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => fetch('/api/economy').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.supporter) setSup(d.supporter); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const act = async (action: string, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/economy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d?.error || 'Failed.');
      else { setMsg(action === 'claimSupporter' ? `+${d.credited} EP!` : 'You are now a Supporter! \u2b50'); load(); onChange?.(); }
    } catch {
      setMsg('Failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!sup) return null;

  return (
    <div className={`rounded-2xl border p-5 ${sup.active ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="mb-1 flex items-center gap-2">
        <Star size={18} className="text-amber-400" fill={sup.active ? '#fbbf24' : 'none'} />
        <h3 className="font-black text-white">Supporter{sup.active ? '' : ' tier'}</h3>
        {sup.active && <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">Active</span>}
      </div>

      {sup.active ? (
        <>
          <p className="mb-3 text-xs text-gray-400">Thanks for supporting! Active until {sup.until ? new Date(sup.until).toLocaleDateString() : '—'}. You get a badge + {sup.monthlyEp} EP every month.</p>
          <button onClick={() => act('claimSupporter')} disabled={busy || !sup.claimable} className="rounded-full bg-amber-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:opacity-40">
            {busy ? <Loader2 size={13} className="animate-spin" /> : sup.claimable ? `Claim ${sup.monthlyEp} EP` : 'Claimed this month'}
          </button>
        </>
      ) : (
        <>
          <p className="mb-1 text-xs text-gray-400">Support the hub and get:</p>
          <ul className="mb-3 space-y-1 text-xs text-gray-400">
            <li className="flex items-center gap-1.5"><Check size={12} className="text-amber-400" /> A gold Supporter badge on your profile</li>
            <li className="flex items-center gap-1.5"><Check size={12} className="text-amber-400" /> {sup.monthlyEp} EP every month</li>
          </ul>
          <button onClick={() => act('buySupporter', `Become a Supporter for ${sup.costEp} EP (30 days)?`)} disabled={busy} className="rounded-full bg-amber-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : `Become Supporter \u00b7 ${sup.costEp} EP / 30d`}
          </button>
        </>
      )}
      {msg ? <p className="mt-2 text-xs font-bold text-amber-200">{msg}</p> : null}
    </div>
  );
}
