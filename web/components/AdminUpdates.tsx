'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Trash2 } from 'lucide-react';

type Update = { id: string; title: string; body: string; version: string; createdAt: string | null };

export default function AdminUpdates() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => fetch('/api/updates').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setUpdates(d.updates || []); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const post = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/updates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, version, body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d?.error || 'Failed.');
      else { setTitle(''); setVersion(''); setBody(''); setMsg('Posted!'); load(); }
    } catch {
      setMsg('Failed.');
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    if (!window.confirm('Delete this update?')) return;
    try {
      await fetch(`/api/updates?id=${id}`, { method: 'DELETE' });
      load();
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
        <Sparkles size={16} /> Updates / What&apos;s New
      </h2>
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-2 flex flex-wrap gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. New profile themes!)" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#08080c] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none" />
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.2 (optional)" className="w-32 rounded-lg border border-white/10 bg-[#08080c] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none" />
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What changed? (supports line breaks)" rows={4} className="mb-2 w-full resize-y rounded-lg border border-white/10 bg-[#08080c] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none" />
        <div className="flex items-center justify-end gap-3">
          {msg ? <span className="text-xs font-bold text-cyan-300">{msg}</span> : null}
          <button onClick={post} disabled={busy || title.trim().length < 2 || body.trim().length < 2} className="rounded-full bg-cyan-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:opacity-40">
            {busy ? <Loader2 size={13} className="animate-spin" /> : 'Post update'}
          </button>
        </div>
      </div>

      {updates.length > 0 && (
        <div className="space-y-2">
          {updates.map((u) => (
            <div key={u.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-white">{u.title}</p>
                  {u.version && <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">{u.version}</span>}
                  <span className="text-[10px] text-gray-600">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}</span>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-gray-400">{u.body}</p>
              </div>
              <button onClick={() => del(u.id)} className="shrink-0 text-gray-600 hover:text-red-400" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
