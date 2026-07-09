'use client';
import React from 'react';
import { getTier, getNextTier, tierProgress } from '../lib/tiers';

type Props = {
  elo: number;
  px?: number;            // badge size in pixels
  showName?: boolean;     // rank name next to the badge
  showElo?: boolean;      // "1234 ELO" line
  showProgress?: boolean; // progress bar toward next rank
  className?: string;
};

export default function TierBadge({
  elo,
  px = 40,
  showName = false,
  showElo = false,
  showProgress = false,
  className = '',
}: Props) {
  const tier = getTier(elo);
  const next = getNextTier(elo);
  const progress = tierProgress(elo);
  const gid = `tier-grad-${tier.index}`;
  const glyphSize = tier.glyph.length >= 3 ? 30 : tier.glyph.length === 2 ? 40 : 48;

  const hex = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      style={{ filter: `drop-shadow(0 0 ${Math.round(px * 0.18)}px ${tier.glow})`, flexShrink: 0 }}
      aria-label={tier.name}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="38%" stopColor={tier.color} />
          <stop offset="100%" stopColor={tier.color2} />
        </linearGradient>
      </defs>
      <polygon
        points="50,4 91,27 91,73 50,96 9,73 9,27"
        fill={`url(#${gid})`}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="3"
      />
      {tier.top ? (
        // Crown for Exquisite Pro League
        <path
          d="M27 64 L23 39 L39 51 L50 33 L61 51 L77 39 L73 64 Z"
          fill={tier.text}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <text x="50" y="51" dominantBaseline="central" textAnchor="middle" fontSize={glyphSize} fontWeight="900" fill={tier.text}>
          {tier.glyph}
        </text>
      )}
    </svg>
  );

  if (!showName && !showElo && !showProgress) {
    return className ? <span className={className}>{hex}</span> : hex;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {hex}
      <div className="min-w-0">
        {showName && (
          <p className="text-lg font-black uppercase tracking-wide" style={{ color: tier.color }}>
            {tier.name}
          </p>
        )}
        {showElo && <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{Math.round(elo)} ELO</p>}
        {showProgress && (
          <div className="mt-2 w-48 max-w-full">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: tier.color }} />
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {next ? `${Math.max(0, next.min - Math.round(elo))} ELO to ${next.name}` : 'Top rank reached'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
