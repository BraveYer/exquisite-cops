'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import { SOCIALS } from '../../lib/socials';
import PageBackground from '../../components/PageBackground';

export default function SettingsPage() {
  const { status } = useSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') { setLoading(false); return; }
    fetch('/api/settings')
      .then(r => (r.ok ? r.json() : { socials: {} }))
      .then(d => { setValues(d.socials || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const update = (key: string, v: string) => setValues(prev => ({ ...prev, [key]: v }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socials: values }),
      });
      if (r.ok) {
        const d = await r.json();
        setValues(d.socials || {});
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />

      <div className="relative mx-auto max-w-xl px-6 py-10 md:py-16">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 font-bold text-gray-400 transition-colors hover:text-cyan-400">
          <ArrowLeft size={20} /> BACK TO HUB
        </Link>

        <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">Public profile</p>
        <h1 className="mb-2 text-4xl font-black tracking-tighter md:text-5xl">
          <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">Settings</span>
        </h1>
        <p className="mb-8 text-sm text-gray-500">Add your social links — they show up on your public profile.</p>

        {status !== 'authenticated' && !loading && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="mb-4 font-bold text-gray-300">Log in to edit your links.</p>
            <button
              onClick={() => signIn('discord', { callbackUrl: '/settings' })}
              className="rounded-full bg-white px-6 py-2 text-sm font-bold text-black transition-all hover:bg-cyan-400"
            >
              CONNECT WITH DISCORD
            </button>
          </div>
        )}

        {loading && status === 'authenticated' && (
          <div className="flex items-center gap-3 py-10 text-cyan-400">
            <Loader2 className="animate-spin" size={22} />
            <span className="font-bold uppercase tracking-widest">Loading…</span>
          </div>
        )}

        {status === 'authenticated' && !loading && (
          <>
            <div className="space-y-3">
              {SOCIALS.map(s => (
                <div
                  key={s.key}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors focus-within:border-cyan-500/40"
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black"
                      style={{ background: `${s.color}22`, color: s.color }}
                    >
                      {s.label.charAt(0)}
                    </span>
                    <span className="text-sm font-bold text-white">{s.label}</span>
                  </div>
                  <input
                    type="url"
                    value={values[s.key] || ''}
                    onChange={e => update(s.key, e.target.value)}
                    placeholder={s.placeholder}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors focus:border-cyan-500/60"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 font-black uppercase tracking-widest text-black transition-all hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : saved ? <Check size={18} /> : null}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save links'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
