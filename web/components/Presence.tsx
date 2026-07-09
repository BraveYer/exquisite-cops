'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const META: Record<string, { color: string; label: string }> = {
  in_match: { color: '#f59e0b', label: 'In match' },
  searching: { color: '#22d3ee', label: 'In queue' },
  online: { color: '#34d399', label: 'Online' },
  offline: { color: '#6b7280', label: 'Offline' },
};

export function presenceMeta(status?: string) {
  return META[status || 'offline'] || META.offline;
}

export function PresenceDot({ status, size = 10, className = '' }: { status?: string; size?: number; className?: string }) {
  const m = presenceMeta(status);
  const active = status && status !== 'offline';
  return (
    <span
      title={m.label}
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, backgroundColor: m.color, boxShadow: active ? `0 0 6px ${m.color}` : 'none' }}
    />
  );
}

export function PresenceLabel({ status }: { status?: string }) {
  const m = presenceMeta(status);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: m.color }}>
      <PresenceDot status={status} size={8} /> {m.label}
    </span>
  );
}

// Batch presence tracker: register accountIds, get their live status, auto-refreshed.
export function usePresence(pollMs = 30000) {
  const idsRef = useRef<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const fetchNow = useCallback(async () => {
    const ids = Array.from(idsRef.current);
    if (ids.length === 0) return;
    try {
      const r = await fetch(`/api/presence?ids=${ids.join(',')}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : { statuses: {} };
      setStatuses((prev) => ({ ...prev, ...(d.statuses || {}) }));
    } catch {
      /* ignore */
    }
  }, []);

  const track = useCallback(
    (newIds: (number | null | undefined)[]) => {
      let added = false;
      for (const id of newIds) if (typeof id === 'number' && !idsRef.current.has(id)) { idsRef.current.add(id); added = true; }
      if (added) fetchNow();
    },
    [fetchNow]
  );

  useEffect(() => {
    const iv = setInterval(fetchNow, pollMs);
    return () => clearInterval(iv);
  }, [fetchNow, pollMs]);

  const statusOf = (accId: number | null | undefined) => statuses[String(accId)] || 'offline';
  return { track, statusOf, refresh: fetchNow };
}
