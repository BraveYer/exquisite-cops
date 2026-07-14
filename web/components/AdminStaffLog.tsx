'use client';

import { useEffect, useState } from 'react';
import { ScrollText, Loader2 } from 'lucide-react';

type Entry = { id: string; actorName: string; action: string; targetName: string | null; target: string | null; details: string | null; createdAt: string | null };

const ACTION_COLOR: Record<string, string> = {
  ban: 'text-red-400',
  mute: 'text-orange-400',
  warn: 'text-yellow-400',
  note: 'text-gray-400',
  'lift sanction': 'text-emerald-400',
  'grant supporter': 'text-amber-300',
  'revoke supporter': 'text-red-400',
  'post update': 'text-cyan-400',
  'delete update': 'text-gray-400',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AdminStaffLog() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch('/api/admin/staff-log', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          setForbidden(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (d) setEntries(d.entries || []); })
      .catch(() => {});
  }, []);

  if (forbidden) return null;

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
        <ScrollText size={16} /> Staff action log
      </h2>
      {!entries ? (
        <div className="flex justify-center py-8 text-cyan-400"><Loader2 className="animate-spin" size={20} /></div>
      ) : entries.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-600">No staff actions logged yet.</p>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="font-bold text-white">{e.actorName}</span>
              <span className={`font-black uppercase tracking-wider ${ACTION_COLOR[e.action] || 'text-gray-300'}`}>{e.action}</span>
              {e.targetName && <span className="truncate text-gray-300">{e.targetName}</span>}
              {e.target && !e.targetName && <span className="text-gray-500">#{e.target}</span>}
              {e.details && <span className="truncate text-xs text-gray-600">· {e.details}</span>}
              <span className="ml-auto shrink-0 text-[11px] text-gray-600">{timeAgo(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
