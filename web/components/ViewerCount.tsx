'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';

export default function ViewerCount({ matchId, active }: { matchId: string; active: boolean }) {
  const [count, setCount] = useState(0);
  const viewerId = useRef<string>('');

  if (!viewerId.current) {
    viewerId.current =
      typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const beat = async () => {
      try {
        const r = await fetch(`/api/match/${matchId}/viewers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewerId: viewerId.current }),
        });
        const d = await r.json();
        if (alive && typeof d.count === 'number') setCount(d.count);
      } catch {
        /* ignore */
      }
    };
    beat();
    const iv = setInterval(beat, 10000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [matchId, active]);

  if (!active || count <= 0) return null;

  return (
    <div className="mb-8 flex items-center justify-center gap-2 text-sm font-bold text-gray-400">
      <Eye size={15} className="text-cyan-400" />
      {count} {count === 1 ? 'person' : 'people'} watching
    </div>
  );
}
