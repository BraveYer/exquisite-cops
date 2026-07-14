'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Circle, Rocket, X, ChevronRight } from 'lucide-react';

const KEY = 'exq_onboard_checklist_dismissed';

type State = { loggedIn: boolean; linked: boolean; verified: boolean; games: number; claimedDaily: boolean; ownsCosmetic: boolean };

export default function OnboardingChecklist() {
  const { status } = useSession();
  const [data, setData] = useState<State | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') setDismissed(localStorage.getItem(KEY) === '1');
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/onboarding', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.loggedIn) setData(d); })
      .catch(() => {});
  }, [status]);

  if (status !== 'authenticated' || dismissed || !data) return null;

  const steps = [
    { done: data.linked, label: 'Connect your Critical Ops account', href: '/link', cta: 'Connect' },
    { done: data.verified, label: 'Verify your account', href: '/verify', cta: 'Verify' },
    { done: data.games >= 5, label: `Play your 5 placement matches${data.games < 5 ? ` (${data.games}/5)` : ''}`, href: '/', cta: 'Find match' },
    { done: data.claimedDaily, label: 'Claim your daily bonus', href: '/', cta: 'Claim' },
    { done: data.ownsCosmetic, label: 'Unlock a profile cosmetic', href: '/shop', cta: 'Shop' },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  if (doneCount === steps.length) return null; // all done → hide

  const dismiss = () => {
    localStorage.setItem(KEY, '1');
    setDismissed(true);
  };

  // The next actionable step (first not-done)
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="mb-8 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-transparent p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-cyan-400" />
          <h2 className="text-sm font-black uppercase tracking-widest text-cyan-300">Getting started</h2>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-gray-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-black text-cyan-300">{doneCount}/{steps.length}</span>
      </div>

      <div className="space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${i === nextIdx ? 'bg-white/[0.04]' : ''}`}>
            {s.done ? <CheckCircle2 size={18} className="shrink-0 text-emerald-400" /> : <Circle size={18} className="shrink-0 text-gray-600" />}
            <span className={`flex-1 text-sm ${s.done ? 'text-gray-500 line-through' : 'font-bold text-white'}`}>{s.label}</span>
            {!s.done && (
              <Link href={s.href} className="flex shrink-0 items-center gap-0.5 rounded-full bg-cyan-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/25">
                {s.cta} <ChevronRight size={12} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
