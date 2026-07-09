'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, ChevronRight } from 'lucide-react';

export default function SeasonBanner() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/season')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setName(d?.active?.name ?? null))
      .catch(() => {});
  }, []);

  if (!name) return null;

  return (
    <Link
      href="/season"
      className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-500/20"
    >
      <Trophy size={16} /> {name} is live — view rewards
      <ChevronRight size={16} />
    </Link>
  );
}
