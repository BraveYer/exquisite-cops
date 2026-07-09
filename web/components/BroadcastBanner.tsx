'use client';

import { useEffect, useState } from 'react';
import { X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Broadcast = { id: number; text: string; level: string };

const STYLES: Record<string, { wrap: string; icon: any; ic: string }> = {
  info: { wrap: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100', icon: Info, ic: 'text-cyan-400' },
  warning: { wrap: 'border-amber-500/40 bg-amber-500/10 text-amber-100', icon: AlertTriangle, ic: 'text-amber-400' },
  success: { wrap: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100', icon: CheckCircle2, ic: 'text-emerald-400' },
};

const KEY = 'exq_broadcast_dismissed';

export default function BroadcastBanner() {
  const [b, setB] = useState<Broadcast | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/broadcast', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive) return;
          if (d?.broadcast) {
            setB(d.broadcast);
            try {
              setDismissed(localStorage.getItem(KEY) === String(d.broadcast.id));
            } catch {
              setDismissed(false);
            }
          } else {
            setB(null);
          }
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  if (!b || dismissed) return null;
  const s = STYLES[b.level] || STYLES.info;
  const Icon = s.icon;

  return (
    <div className="px-6 pt-4 md:px-8">
      <div className={`mx-auto flex max-w-5xl items-start gap-3 rounded-2xl border px-4 py-3 ${s.wrap}`}>
        <Icon size={18} className={`mt-0.5 shrink-0 ${s.ic}`} />
        <p className="flex-1 text-sm font-semibold leading-snug">{b.text}</p>
        <button
          onClick={() => {
            try {
              localStorage.setItem(KEY, String(b.id));
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
          className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
