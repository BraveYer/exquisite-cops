'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Link2, ShieldAlert, X } from 'lucide-react';

export default function LinkAccountBanner() {
  const { status } = useSession();
  const [info, setInfo] = useState<{ linked: boolean; verified: boolean } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') {
      setInfo(null);
      return;
    }
    fetch('/api/user')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setInfo({ linked: !!d.linked, verified: !!d.verified }); })
      .catch(() => {});
  }, [status]);

  if (hidden || status !== 'authenticated' || !info) return null;
  if (info.linked && info.verified) return null;

  const notLinked = !info.linked;

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/[0.07]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-sm">
        {notLinked ? <Link2 size={16} className="shrink-0 text-amber-400" /> : <ShieldAlert size={16} className="shrink-0 text-amber-400" />}
        <p className="min-w-0 flex-1 text-amber-100/90">
          {notLinked ? (
            <>
              <span className="font-black text-amber-300">Link your account to play.</span> Run{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">/link</code> on Discord to connect your Critical Ops account, then{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">/verify</code>.
            </>
          ) : (
            <>
              <span className="font-black text-amber-300">Almost there — verify your account.</span> Run{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">/verify</code> on Discord to join queues and earn EP.
            </>
          )}
        </p>
        <button onClick={() => setHidden(true)} className="shrink-0 text-amber-400/70 hover:text-amber-200" title="Dismiss">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
