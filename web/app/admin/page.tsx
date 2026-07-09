'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldAlert, AlertTriangle, Swords, ShieldCheck, Trophy, Flag, Check, X, BarChart3, Megaphone, SlidersHorizontal, TrendingDown, Download } from 'lucide-react';
import PageBackground from '../../components/PageBackground';
import { FLAGS } from '../../lib/flags';

type Report = { winner: string; by: string };
type ActiveMatch = {
  matchId: string; map: string; status: string; disputed: boolean;
  teamA: string[]; teamB: string[];
  roomName: string | null; roomPassword: string | null;
  reports: Report[]; createdAt: string | null;
};
type RecentMatch = { matchId: string; map: string; winner: string | null; completedAt: string | null; teamA: string[]; teamB: string[] };
type Staff = { copsName: string; accountId: number | null; staffLevel: string };
type Data = { me: { staffLevel: string }; active: ActiveMatch[]; recent: RecentMatch[]; staff: Staff[] };

const statusStyle: Record<string, string> = {
  ongoing: 'border-white/15 bg-white/5 text-gray-300',
  pending_review: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  disputed: 'border-red-500/50 bg-red-500/10 text-red-300',
};

function fmt(s: string | null) {
  if (!s) return '';
  try { return new Date(s).toLocaleString(); } catch { return ''; }
}
function team(list: string[]) { return list.length ? list.join(', ') : '—'; }

export default function AdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'unauth' | 'error'>('loading');
  const [season, setSeason] = useState<{ active: any; past: any[] } | null>(null);
  const [reports, setReports] = useState<{ id: string; matchId: string; reportedName: string; reportedAccountId: number | null; reporterName: string; reason: string; note: string; createdAt: string }[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bcText, setBcText] = useState('');
  const [bcLevel, setBcLevel] = useState('info');
  const [bcActive, setBcActive] = useState(false);
  const [bcBusy, setBcBusy] = useState(false);
  const [bcMsg, setBcMsg] = useState('');
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  const [flagBusy, setFlagBusy] = useState('');
  const [decay, setDecay] = useState<{ eligible: number; rankedPlayers: number; config: any } | null>(null);
  const [decayBusy, setDecayBusy] = useState(false);
  const [decayMsg, setDecayMsg] = useState('');

  const loadDecay = () => {
    fetch('/api/admin/decay').then(r => (r.ok ? r.json() : null)).then(d => { if (d && !d.error) setDecay(d); }).catch(() => {});
  };
  const runDecay = async () => {
    if (!window.confirm('Apply ELO decay to inactive players now?')) return;
    setDecayBusy(true);
    setDecayMsg('');
    try {
      const r = await fetch('/api/admin/decay', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setDecayMsg(d?.error || 'Failed.');
      else { setDecayMsg(`Decayed ${d.decayed} player${d.decayed === 1 ? '' : 's'} (−${d.eloRemoved} ELO total).`); loadDecay(); }
    } catch {
      setDecayMsg('Failed.');
    } finally {
      setDecayBusy(false);
    }
  };

  const loadFlags = () => {
    fetch('/api/flags').then(r => (r.ok ? r.json() : null)).then(d => { if (d) setFlags(d.flags); }).catch(() => {});
  };
  const toggleFlag = async (key: string, value: boolean) => {
    setFlagBusy(key);
    try {
      const r = await fetch('/api/flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.flags) setFlags(d.flags);
    } catch {
      /* ignore */
    } finally {
      setFlagBusy('');
    }
  };

  const loadBroadcast = () => {
    fetch('/api/broadcast', { method: 'PUT' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setBcText(d.text || ''); setBcLevel(d.level || 'info'); setBcActive(!!d.active); } })
      .catch(() => {});
  };
  const saveBroadcast = async (active: boolean) => {
    setBcBusy(true);
    setBcMsg('');
    try {
      const r = await fetch('/api/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: bcText, level: bcLevel, active }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setBcMsg(d?.error || 'Could not save.');
      else { setBcActive(active); setBcMsg(active ? 'Broadcast published.' : 'Broadcast cleared.'); }
    } catch {
      setBcMsg('Could not save.');
    } finally {
      setBcBusy(false);
    }
  };

  const loadSeason = () => {
    fetch('/api/season').then(r => (r.ok ? r.json() : null)).then(d => setSeason(d)).catch(() => {});
  };
  const loadReports = () => {
    fetch('/api/admin/reports')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setReports(d.reports || []); setResolvedCount(d.resolvedCount || 0); } })
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/admin')
      .then(async res => {
        if (res.status === 403) { setState('forbidden'); return; }
        if (res.status === 401) { setState('unauth'); return; }
        if (!res.ok) { setState('error'); return; }
        setData(await res.json());
        setState('ok');
      })
      .catch(() => setState('error'));
    loadSeason();
    loadReports();
    loadBroadcast();
    loadFlags();
    loadDecay();
  }, []);

  const seasonAction = async (action: 'start' | 'end') => {
    if (action === 'end' && !window.confirm("End the current season? This snapshots the standings and soft-resets everyone's ELO.")) return;
    setBusy(true);
    try {
      await fetch('/api/admin/season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      loadSeason();
    } finally {
      setBusy(false);
    }
  };

  const reportAction = async (id: string, action: 'resolve' | 'dismiss') => {
    try {
      await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      loadReports();
    } catch {
      /* ignore */
    }
  };

  const REASON_LABELS: Record<string, string> = {
    cheating: 'Cheating',
    toxic: 'Toxic / abusive',
    afk: 'AFK / leaving',
    smurf: 'Smurfing',
    other: 'Other',
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />

      <div className="relative mx-auto max-w-4xl px-6 py-10 md:py-14">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 font-bold text-gray-400 transition-colors hover:text-cyan-400">
          <ArrowLeft size={20} /> BACK TO HUB
        </Link>

        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-24 text-cyan-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="font-bold uppercase tracking-widest">Loading…</p>
          </div>
        )}

        {(state === 'forbidden' || state === 'unauth' || state === 'error') && (
          <div className="flex flex-col items-center gap-4 py-24 text-center text-gray-400">
            <ShieldAlert size={40} className="text-red-500/70" />
            <p className="text-xl font-black text-white">
              {state === 'unauth' ? 'Please log in' : state === 'error' ? 'Something went wrong' : 'Staff access only'}
            </p>
            <p className="text-sm">
              {state === 'forbidden' ? 'Ask a server admin to grant you a staff role in Discord.' : ''}
            </p>
          </div>
        )}

        {state === 'ok' && data && (
          <>
            <div className="mb-10 text-center">
              <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent">
                ADMIN
              </h1>
              <p className="mt-2 text-sm font-bold uppercase tracking-widest text-gray-500">
                Signed in as <span className="text-cyan-400">{data.me.staffLevel}</span>
              </p>
            </div>

            <div className="mb-10 flex justify-center">
              <Link href="/admin/dashboard" className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-black uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-500/20">
                <BarChart3 size={16} /> Analytics Dashboard
              </Link>
            </div>

            {/* Global broadcast */}
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
              <Megaphone size={16} /> Global broadcast
            </h2>
            <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <textarea
                value={bcText}
                onChange={(e) => setBcText(e.target.value.slice(0, 240))}
                rows={2}
                placeholder="Announcement shown at the top of every page…"
                className="w-full resize-none rounded-xl border border-white/10 bg-[#08080c] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                  {['info', 'warning', 'success'].map((l) => (
                    <button key={l} onClick={() => setBcLevel(l)} className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors ${bcLevel === l ? 'bg-white/15 text-white' : 'text-gray-500 hover:bg-white/5'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {bcMsg ? <span className="text-xs font-bold text-cyan-300">{bcMsg}</span> : null}
                  {bcActive && (
                    <button onClick={() => saveBroadcast(false)} disabled={bcBusy} className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50">
                      Clear
                    </button>
                  )}
                  <button onClick={() => saveBroadcast(true)} disabled={bcBusy || bcText.trim().length < 2} className="flex items-center gap-1.5 rounded-full bg-cyan-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:opacity-40">
                    {bcBusy ? <Loader2 size={13} className="animate-spin" /> : null} {bcActive ? 'Update' : 'Publish'}
                  </button>
                </div>
              </div>
              {bcActive ? (
                <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-emerald-400">● Live now</p>
              ) : (
                <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-gray-600">Not shown</p>
              )}
            </div>

            {/* Feature flags */}
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
              <SlidersHorizontal size={16} /> Feature flags
            </h2>
            <div className="mb-10 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.03]">
              {FLAGS.map((f) => {
                const on = flags ? flags[f.key] !== false : true;
                return (
                  <div key={f.key} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{f.label}</p>
                      {f.desc ? <p className="text-xs text-gray-500">{f.desc}</p> : null}
                    </div>
                    <button
                      onClick={() => toggleFlag(f.key, !on)}
                      disabled={!flags || flagBusy === f.key}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-white/15'}`}
                      aria-label={`Toggle ${f.label}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ELO decay */}
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
              <TrendingDown size={16} /> ELO decay
            </h2>
            <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-gray-400">
                Inactive ranked players lose <span className="font-bold text-white">{decay?.config?.perWeek ?? 25} ELO</span> per week after <span className="font-bold text-white">{decay?.config?.graceDays ?? 14} days</span> without a match (floor {decay?.config?.floor ?? 1000}).
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{decay ? `${decay.eligible} player${decay.eligible === 1 ? '' : 's'} eligible now` : 'Loading…'}</span>
                <div className="flex items-center gap-2">
                  {decayMsg ? <span className="text-xs font-bold text-cyan-300">{decayMsg}</span> : null}
                  <button onClick={runDecay} disabled={decayBusy} className="flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:opacity-50">
                    {decayBusy ? <Loader2 size={13} className="animate-spin" /> : <TrendingDown size={13} />} Run decay
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-600">Safe to run repeatedly — each player decays at most once per week.</p>
            </div>

            {/* Data export */}
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
              <Download size={16} /> Data export
            </h2>
            <div className="mb-10 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <a href="/api/admin/export?type=players" className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-gray-200 transition-colors hover:bg-white/5">
                <Download size={14} /> Players CSV
              </a>
              <a href="/api/admin/export?type=matches" className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-gray-200 transition-colors hover:bg-white/5">
                <Download size={14} /> Matches CSV
              </a>
              <span className="text-[11px] text-gray-600">Downloads open in a new tab as .csv</span>
            </div>

            {/* Season */}
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
              <Trophy size={16} /> Season
            </h2>
            <div className="mb-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5 sm:flex-row">
              <div className="text-center sm:text-left">
                {season?.active ? (
                  <>
                    <p className="text-lg font-black text-white">{season.active.name}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Active</p>
                  </>
                ) : (
                  <p className="font-bold uppercase tracking-widest text-gray-500">No active season</p>
                )}
              </div>
              {season?.active ? (
                <button
                  onClick={() => seasonAction('end')}
                  disabled={busy}
                  className="rounded-full bg-red-500/90 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  End season
                </button>
              ) : (
                <button
                  onClick={() => seasonAction('start')}
                  disabled={busy}
                  className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-cyan-300 disabled:opacity-50"
                >
                  Start season
                </button>
              )}
            </div>

            {/* Reports */}
            <h2 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
              <Flag size={16} /> Reports
              {reports.length > 0 && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-300">{reports.length} open</span>
              )}
              {resolvedCount > 0 && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-400">{resolvedCount} handled</span>
              )}
            </h2>
            {reports.length === 0 ? (
              <p className="mb-10 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 text-center text-sm font-bold uppercase tracking-widest text-gray-600">
                No open reports
              </p>
            ) : (
              <div className="mb-10 space-y-2">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {r.reportedAccountId ? (
                            <Link href={`/profile/${r.reportedAccountId}`} className="font-black text-white hover:text-cyan-400">
                              {r.reportedName}
                            </Link>
                          ) : (
                            <span className="font-black text-white">{r.reportedName}</span>
                          )}
                          <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-300">
                            {REASON_LABELS[r.reason] || r.reason}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">
                          reported by <span className="text-gray-300">{r.reporterName}</span> ·{' '}
                          <Link href={`/match/${r.matchId}`} className="text-gray-400 hover:text-cyan-400">
                            match #{r.matchId}
                          </Link>
                        </p>
                        {r.note ? <p className="mt-2 rounded-lg bg-black/30 px-3 py-2 text-sm text-gray-300">{r.note}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => reportAction(r.id, 'resolve')}
                          title="Mark as actioned"
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                        >
                          <Check size={14} /> Resolve
                        </button>
                        <button
                          onClick={() => reportAction(r.id, 'dismiss')}
                          title="Dismiss (no action)"
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          <X size={14} /> Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active matches */}
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
              <Swords size={16} /> Active Matches
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300">{data.active.length}</span>
            </h2>
            {data.active.length === 0 ? (
              <p className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-center font-bold uppercase tracking-widest text-gray-600">
                Nothing live right now.
              </p>
            ) : (
              <div className="mb-10 space-y-3">
                {data.active.map(m => (
                  <div
                    key={m.matchId}
                    className={`rounded-2xl border p-5 ${m.disputed ? 'border-red-500/40 bg-red-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-white">#{m.matchId}</span>
                        <span className="text-sm text-gray-400">{m.map}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusStyle[m.status] || statusStyle.ongoing}`}>
                          {m.status.replace('_', ' ')}
                        </span>
                      </div>
                      <Link href={`/match/${m.matchId}`} className="text-xs font-bold text-cyan-400 hover:underline">
                        View →
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400">Team A</p>
                        <p className="text-gray-200">{team(m.teamA)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-400">Team B</p>
                        <p className="text-gray-200">{team(m.teamB)}</p>
                      </div>
                    </div>

                    {m.reports.length > 0 && (
                      <div className="mt-3 border-t border-white/10 pt-3">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Player reports</p>
                        {m.reports.map((r, i) => (
                          <p key={i} className="text-sm text-gray-300">
                            <span className="font-bold">{r.by}</span> → Team {r.winner}
                          </p>
                        ))}
                      </div>
                    )}

                    {m.disputed && (
                      <p className="mt-3 flex items-center gap-2 text-sm font-bold text-red-300">
                        <AlertTriangle size={15} /> Conflicting reports — needs a manual decision.
                      </p>
                    )}

                    <p className="mt-3 text-xs text-gray-500">
                      Confirm or cancel in this match's private <span className="text-gray-300">#match-{m.matchId}</span> channel on Discord.
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent results */}
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Recent Results</h2>
            {data.recent.length === 0 ? (
              <p className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-center font-bold uppercase tracking-widest text-gray-600">
                No completed matches yet.
              </p>
            ) : (
              <div className="mb-10 space-y-2">
                {data.recent.map(m => (
                  <Link
                    key={m.matchId}
                    href={`/match/${m.matchId}`}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-7 items-center rounded-md px-2 text-xs font-black ${m.winner === 'A' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-violet-500/15 text-violet-300'}`}>
                        {m.winner ? `Team ${m.winner}` : '—'}
                      </span>
                      <span className="text-sm text-gray-300">{m.map}</span>
                      <span className="hidden text-xs text-gray-500 sm:inline">{team(m.teamA)} vs {team(m.teamB)}</span>
                    </div>
                    <span className="text-[11px] text-gray-500">{fmt(m.completedAt)}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Staff roster */}
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Staff</h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
              {data.staff.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-gray-600">No staff assigned.</p>
              ) : (
                data.staff.map((s, i) => {
                  const inner = (
                    <>
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={15} className={s.staffLevel === 'admin' ? 'text-cyan-400' : 'text-gray-400'} />
                        <span className="font-bold text-white">{s.copsName}</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${s.staffLevel === 'admin' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/10 text-gray-300'}`}>
                        {s.staffLevel}
                      </span>
                    </>
                  );
                  return s.accountId != null ? (
                    <Link key={i} href={`/profile/${s.accountId}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.05]">
                      {inner}
                    </Link>
                  ) : (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5">{inner}</div>
                  );
                })
              )}
            </div>
            <p className="mt-2 px-1 text-xs text-gray-600">
              Roles are managed by assigning the staff role in Discord — the bot syncs them here automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
