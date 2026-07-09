'use client';

import { useState } from 'react';
import { Flag, Loader2, Check } from 'lucide-react';

type Player = { discordId: string; copsName?: string };

const REASONS: { id: string; label: string }[] = [
  { id: 'cheating', label: 'Cheating' },
  { id: 'toxic', label: 'Toxic / abusive' },
  { id: 'afk', label: 'AFK / leaving' },
  { id: 'smurf', label: 'Smurfing' },
  { id: 'other', label: 'Other' },
];

export default function ReportPanel({ matchId, players }: { matchId: string; players: Player[] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  if (!players.length) return null;

  const submit = async () => {
    if (!target || !reason || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, reportedId: target, reason, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d?.error || 'Could not submit the report.');
      } else {
        setDone(true);
        setTarget('');
        setReason('');
        setNote('');
      }
    } catch {
      setErr('Could not submit the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      {!open ? (
        <button
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="flex w-full items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-red-400"
        >
          <Flag size={15} /> Report a player
        </button>
      ) : done ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <Check size={20} />
          </div>
          <p className="text-sm font-bold text-white">Report submitted</p>
          <p className="text-xs text-gray-500">Staff will review it. Thanks for keeping the hub fair.</p>
          <button onClick={() => setOpen(false)} className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300">
            Close
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
              <Flag size={15} className="text-red-400" /> Report a player
            </p>
            <button onClick={() => setOpen(false)} className="text-xs font-bold uppercase tracking-widest text-gray-600 hover:text-gray-400">
              Cancel
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Player</p>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c10] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
            >
              <option value="">Select a player…</option>
              {players.map((p) => (
                <option key={p.discordId} value={p.discordId}>
                  {p.copsName || 'Unknown'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Reason</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                    reason === r.id
                      ? 'border-red-400/60 bg-red-500/15 text-red-300'
                      : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Note (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="What happened?"
              className="w-full resize-none rounded-xl border border-white/10 bg-[#0c0c10] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
            />
          </div>

          {err ? <p className="text-xs font-bold text-red-400">{err}</p> : null}

          <button
            onClick={submit}
            disabled={!target || !reason || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/90 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Flag size={15} />}
            Submit report
          </button>
        </div>
      )}
    </div>
  );
}
