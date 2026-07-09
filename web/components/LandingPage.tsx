'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Shield, Target, Swords, Award, MessageSquare, Crown, ArrowRight, Sparkles } from 'lucide-react';

type Stats = { players: number; matches: number; liveNow: number; season: number | null };

function fmt(n?: number) {
  if (n == null) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const FEATURES = [
  { icon: Shield, title: 'Verified identity', desc: 'Every account is linked to Discord and verified in-game. No smurfs, no impersonators.' },
  { icon: Target, title: 'Real Elo', desc: 'A K-factor rating that rewards consistency and punishes dodging — the ladder you actually earn.' },
  { icon: Swords, title: 'Captain drafts', desc: 'Matches with captain picks and a coin-flip first pick. Teams made the way they should be.' },
  { icon: Award, title: 'Seasons & rewards', desc: 'A fresh ladder each season with snapshots, medals, and a real prize pool for the top.' },
  { icon: MessageSquare, title: 'Live lobbies', desc: 'Lobby and per-match chat, a live online list, and custom in-game rooms with credentials.' },
  { icon: Crown, title: 'Ranked tiers', desc: 'Climb from Challenger to the Exquisite Pro League and show your division off.' },
];

export default function LandingPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats').then(r => (r.ok ? r.json() : null)).then(d => setStats(d)).catch(() => {});
  }, []);

  const queueUp = () => signIn('discord', { callbackUrl: '/' });

  const statItems = [
    { value: fmt(stats?.players), label: 'Players' },
    { value: fmt(stats?.matches), label: 'Matches played' },
    { value: stats?.liveNow ?? 0, label: 'In queue now' },
    { value: stats?.season ? `S${stats.season}` : '—', label: 'Current season' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070709] text-white selection:bg-cyan-500/40">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_20%_-5%,rgba(34,211,238,0.16),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_82%_4%,rgba(168,85,247,0.16),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage: 'radial-gradient(70% 55% at 50% 0%, #000 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(70% 55% at 50% 0%, #000 30%, transparent 80%)',
          }}
        />
      </div>

      <div className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center md:pt-28">
          <Link
            href="/season"
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-500/20"
          >
            <Sparkles size={14} />
            {stats?.season ? `Season ${stats.season} — Now Live` : 'Ranked matchmaking'}
          </Link>

          <h1 className="text-5xl font-black leading-[0.95] tracking-tighter sm:text-6xl md:text-7xl">
            Critical Ops matchmaking
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 bg-clip-text text-transparent">
              for players who compete.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-gray-400 sm:text-lg">
            No smurfs. No throwers. No excuses. Exquisite is the competitive queue where rank actually means
            something — verified lobbies, real Elo, captain drafts, and rewards that hit.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={queueUp}
              className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-7 py-3.5 font-black text-black shadow-[0_0_40px_-6px_rgba(34,211,238,0.6)] transition-all hover:scale-[1.03] hover:bg-cyan-300"
            >
              Queue Up <ArrowRight size={18} />
            </button>
            <Link
              href="/leaderboard"
              className="rounded-2xl border border-white/15 bg-white/[0.03] px-7 py-3.5 font-bold text-white transition-colors hover:bg-white/[0.07]"
            >
              Leaderboard
            </Link>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-y border-white/5 bg-white/[0.015]">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px md:grid-cols-4">
            {statItems.map((s, i) => (
              <div key={i} className="px-6 py-8 text-center">
                <p className="bg-gradient-to-b from-cyan-300 to-violet-400 bg-clip-text text-4xl font-black tracking-tighter text-transparent md:text-5xl">
                  {s.value}
                </p>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">The platform</p>
          <h2 className="mt-3 max-w-2xl text-4xl font-black leading-tight tracking-tighter md:text-5xl">
            Built for players who actually compete.
          </h2>

          <div className="mt-12 grid grid-cols-1 overflow-hidden rounded-3xl border border-white/10 md:grid-cols-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="border-b border-white/10 p-7 transition-colors hover:bg-white/[0.02] md:[&:nth-child(3n)]:border-r-0 md:border-r">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                    <Icon size={20} />
                  </div>
                  <h3 className="mb-2 text-lg font-black text-white">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-6 pb-28">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(34,211,238,0.12),transparent_70%)]" />
            <div className="relative">
              <h2 className="text-4xl font-black leading-tight tracking-tighter md:text-6xl">
                Stop playing pubs.
                <br />
                <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
                  Start ranking up.
                </span>
              </h2>
              <p className="mx-auto mt-5 max-w-md text-gray-400">
                Connect your Discord, get verified, and drop into your first ranked match in minutes.
              </p>
              <button
                onClick={queueUp}
                className="mx-auto mt-8 flex items-center gap-2 rounded-2xl bg-cyan-400 px-8 py-4 text-lg font-black text-black shadow-[0_0_40px_-6px_rgba(34,211,238,0.6)] transition-all hover:scale-[1.03] hover:bg-cyan-300"
              >
                Connect with Discord <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
