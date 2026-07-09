'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Swords, Users, Coins, Sparkles, ChevronLeft, ChevronRight, X } from 'lucide-react';

const KEY = 'exq_onboarded_v1';

const STEPS = [
  {
    icon: Sparkles,
    color: '#22d3ee',
    title: 'Welcome to Exquisite Cops',
    body: 'The competitive matchmaking hub for Critical Ops — ranked matches, clubs, tournaments and more. Here’s a 20-second tour.',
  },
  {
    icon: Swords,
    color: '#f59e0b',
    title: 'Play ranked',
    body: 'Join the queue from the Hub to get matched into a balanced game. Win to climb the ELO ladder and rank up through the tiers.',
  },
  {
    icon: Users,
    color: '#a855f7',
    title: 'Get social',
    body: 'Add friends, join or create a club, post in the feed, and team up through LFG. Chat lives in every corner of the app.',
  },
  {
    icon: Coins,
    color: '#34d399',
    title: 'Earn & customize',
    body: 'Collect EP from daily bonuses, missions and wins — then spend it in the Shop on frames, name styles and profile themes.',
  },
];

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;
  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c12]">
        <button onClick={close} className="absolute right-4 top-4 z-10 text-gray-500 hover:text-white"><X size={18} /></button>

        <div className="px-8 pb-6 pt-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: `${s.color}1f`, boxShadow: `0 0 40px ${s.color}33` }}>
            <Icon size={30} style={{ color: s.color }} />
          </div>
          <h2 className="mb-2 text-2xl font-black tracking-tight text-white">{s.title}</h2>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-400">{s.body}</p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-cyan-400' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-6 py-4">
          {step > 0 ? (
            <button onClick={() => setStep((v) => v - 1)} className="flex items-center gap-1 text-sm font-bold text-gray-400 hover:text-white">
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button onClick={close} className="text-sm font-bold text-gray-500 hover:text-white">Skip</button>
          )}

          {last ? (
            <Link href="/" onClick={close} className="flex items-center gap-1.5 rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-cyan-400">
              Get started
            </Link>
          ) : (
            <button onClick={() => setStep((v) => v + 1)} className="flex items-center gap-1.5 rounded-full bg-white px-6 py-2.5 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-cyan-400">
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
