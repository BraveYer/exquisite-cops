'use client';

import { useState, useRef } from 'react';
import { Image as ImageIcon, Megaphone, Loader2, Send, X, Upload, BarChart3, Plus } from 'lucide-react';

export default function PostComposer({ isStaff, onPosted }: { isStaff?: boolean; onPosted?: () => void }) {
  const [text, setText] = useState('');
  const [showMedia, setShowMedia] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [announcement, setAnnouncement] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        if (res.status === 404) setErr('Upload route not found — fully restart the dev server (Ctrl+C, then npm run dev).');
        else setErr(d?.error || `Upload failed (${res.status})`);
        return;
      }
      if (!d?.url) {
        setErr('Upload failed — no URL returned.');
        return;
      }
      setMediaUrl(d.url);
      setShowMedia(true);
    } catch {
      setErr('Upload failed — network error.');
    } finally {
      setUploading(false);
    }
  };

  const isImage = mediaUrl && (mediaUrl.startsWith('/api/uploads/') || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(mediaUrl));

  const validPoll = showPoll ? pollOptions.map((o) => o.trim()).filter(Boolean) : [];
  const canPost = (text.trim() || mediaUrl.trim() || validPoll.length >= 2) && !busy;

  const submit = async () => {
    if (!canPost) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', text, mediaUrl, announcement, ...(showPoll && validPoll.length >= 2 ? { poll: validPoll } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d?.error || 'Could not post.');
      } else {
        setText('');
        setMediaUrl('');
        setShowMedia(false);
        setAnnouncement(false);
        setShowPoll(false);
        setPollOptions(['', '']);
        onPosted?.();
      }
    } catch {
      setErr('Could not post.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`mb-6 rounded-2xl border p-4 ${announcement ? 'border-amber-400/30 bg-amber-500/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        rows={showMedia ? 2 : 3}
        placeholder="Share something with the community…"
        className="w-full resize-none bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
      />

      {showMedia && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c0c10] px-3 py-2">
          <ImageIcon size={15} className="shrink-0 text-cyan-400" />
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Paste an image, YouTube or Streamable link…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
          />
          <button onClick={() => { setShowMedia(false); setMediaUrl(''); }} className="text-gray-600 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {isImage && (
        <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt=""
            className="max-h-64 w-full object-cover"
            onError={() => setErr('Uploaded image could not load — restart the dev server so /api/uploads is registered, then hard-refresh.')}
          />
        </div>
      )}

      {showPoll && (
        <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-[#0c0c10] p-3">
          {pollOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <BarChart3 size={14} className="shrink-0 text-violet-400" />
              <input
                value={opt}
                onChange={(e) => setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value.slice(0, 80) : o)))}
                placeholder={`Option ${i + 1}`}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
              />
              {pollOptions.length > 2 && (
                <button onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))} className="text-gray-600 hover:text-white"><X size={14} /></button>
              )}
            </div>
          ))}
          {pollOptions.length < 4 && (
            <button onClick={() => setPollOptions((prev) => [...prev, ''])} className="flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-violet-200">
              <Plus size={13} /> Add option
            </button>
          )}
        </div>
      )}

      {err ? <p className="mt-2 text-xs font-bold text-red-400">{err}</p> : null}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={onFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Upload an image"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
          </button>
          <button
            onClick={() => setShowMedia((s) => !s)}
            title="Add image or clip by link"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${showMedia ? 'bg-cyan-500/15 text-cyan-300' : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'}`}
          >
            <ImageIcon size={14} /> Link
          </button>
          <button
            onClick={() => setShowPoll((s) => !s)}
            title="Add a poll"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${showPoll ? 'bg-violet-500/15 text-violet-300' : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'}`}
          >
            <BarChart3 size={14} /> Poll
          </button>
          {isStaff && (
            <button
              onClick={() => setAnnouncement((a) => !a)}
              title="Post as announcement"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${announcement ? 'bg-amber-500/15 text-amber-300' : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'}`}
            >
              <Megaphone size={14} /> Announce
            </button>
          )}
        </div>
        <button
          onClick={submit}
          disabled={!canPost}
          className="flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-2 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Post
        </button>
      </div>
    </div>
  );
}
