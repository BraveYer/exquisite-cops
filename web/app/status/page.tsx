'use client';

import { useEffect, useState } from 'react';
import { Globe, Database, Bot, CheckCircle2, XCircle, HelpCircle, Loader2 } from 'lucide-react';
import PageBackground from '../../components/PageBackground';

type Comp = 'operational' | 'down' | 'unknown';
type Status = {
  status: 'operational' | 'degraded' | 'partial';
  components: { website: Comp; database: Comp; bot: Comp };
  bot: { online: boolean; lastSeen: string | null; guilds: number | null; uptimeSec: number | null };
  checkedAt: string;
};

const LABEL: Record<Comp, string> = { operational: 'Operational', down: 'Down', unknown: 'Unknown' };
const DOT: Record<Comp, string> = { operational: 'bg-emerald-400', down: 'bg-red-500', unknown: 'bg-gray-500' };
const TEXT: Record<Comp, string> = { operational: 'text-emerald-400', down: 'text-red-400', unknown: 'text-gray-500' };

function StatusIcon({ s }: { s: Comp }) {
  if (s === 'operational') return <CheckCircle2 size={18} className="text-emerald-400" />;
  if (s === 'down') return <XCircle size={18} className="text-red-400" />;
  return <HelpCircle size={18} className="text-gray-500" />;
}

function fmtUptime(sec: number | null): string {
  if (sec == null) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function StatusPage() {
  const [data, setData] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/status', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) { setData(d); setLoading(false); } })
        .catch(() => { if (alive) setLoading(false); });
    load();
    const iv = setInterval(load, 20000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const overall = data?.status;
  const rows: { key: 'website' | 'database' | 'bot'; label: string; Icon: typeof Globe; sub: string }[] = [
    { key: 'website', label: 'Website', Icon: Globe, sub: 'exquisitecops.netlify.app' },
    { key: 'database', label: 'Database', Icon: Database, sub: 'MongoDB Atlas' },
    { key: 'bot', label: 'Discord Bot', Icon: Bot, sub: data?.bot?.online ? `${data.bot.guilds ?? '—'} servers · up ${fmtUptime(data.bot.uptimeSec)}` : `Last seen ${ago(data?.bot?.lastSeen ?? null)}` },
  ];

  return (
    <div className="relative min-h-screen">
      <PageBackground />
      <div className="relative mx-auto max-w-2xl px-4 py-12">
        <div className="mb-2 text-center text-sm font-bold uppercase tracking-[0.3em] text-cyan-500">System</div>
        <h1 className="mb-8 text-center text-4xl font-black tracking-tighter">Status</h1>

        {loading ? (
          <div className="flex justify-center py-16 text-cyan-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : !data ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-gray-500">Couldn&apos;t load status.</p>
        ) : (
          <>
            <div
              className={`mb-8 flex items-center justify-center gap-3 rounded-2xl border px-5 py-5 text-lg font-black ${
                overall === 'operational' ? 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300' : 'border-amber-500/25 bg-amber-500/[0.08] text-amber-300'
              }`}
            >
              <span className="relative flex h-3 w-3">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${overall === 'operational' ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
                <span className={`relative inline-flex h-3 w-3 rounded-full ${overall === 'operational' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </span>
              {overall === 'operational' ? 'All systems operational' : 'Some systems degraded'}
            </div>

            <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {rows.map(({ key, label, Icon, sub }) => {
                const s = data.components[key];
                return (
                  <div key={key} className="flex items-center gap-4 px-5 py-4">
                    <Icon size={20} className="shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white">{label}</p>
                      <p className="truncate text-xs text-gray-500">{sub}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${DOT[s]}`} />
                      <span className={`text-sm font-bold ${TEXT[s]}`}>{LABEL[s]}</span>
                      <StatusIcon s={s} />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[11px] text-gray-600">Auto-refreshes every 20s · last checked {ago(data.checkedAt)}</p>
          </>
        )}
      </div>
    </div>
  );
}
