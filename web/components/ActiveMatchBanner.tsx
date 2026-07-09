'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Swords, ArrowRight } from 'lucide-react';

export default function ActiveMatchBanner() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [matchId, setMatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setMatchId(null);
      return;
    }
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch('/api/my-match', { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        if (!alive) return;
        setMatchId(d?.matchId || null);
        setStatus(d?.status || null);
      } catch {
        /* ignore */
      }
    };
    check();
    const t = setInterval(check, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [session]);

  // Hide when there's nothing active, or when the player is already on the match page.
  if (!matchId || pathname?.startsWith('/match/')) return null;

  const label =
    status === 'drafting'
      ? 'Draft in progress'
      : status === 'veto'
      ? 'Map veto in progress'
      : 'Your match is live';

  return (
    <Link
      href={`/match/${matchId}`}
      className="group fixed right-4 top-16 z-[60] flex items-center gap-3 rounded-full border border-cyan-400/40 bg-[#0c1418]/95 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_30px_-5px_rgba(34,211,238,0.6)] backdrop-blur transition-all hover:border-cyan-300/70 hover:shadow-[0_0_40px_-5px_rgba(34,211,238,0.8)] md:right-6 md:top-16"
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/40" />
        <Swords size={16} className="relative text-cyan-300" />
      </span>
      <span>
        {label} — <span className="text-cyan-300">join now</span>
      </span>
      <ArrowRight size={16} className="text-cyan-300 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
