'use client';

import { useEffect, useState } from 'react';

// "Every Profile is a Stage" — original recreation: crossing spotlights over a
// dark stage with shimmering gold + accent glitter scattering down. Two variants.
export default function StageEffect({ variant = 'orange' }: { variant?: 'orange' | 'teal' }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 30);
    return () => clearTimeout(t);
  }, []);

  const accent = variant === 'teal' ? '#8CBA92' : '#FF924E';
  const accent2 = variant === 'teal' ? '#5fd6c4' : '#ffb06b';
  const gold = '#ffd36b';

  const glitter = Array.from({ length: 46 }, (_, i) => ({
    x: (i * 149) % 1100,
    startY: -((i * 53) % 220) - 20,
    size: 3 + ((i * 17) % 10) / 2,
    color: i % 3 === 0 ? accent : i % 3 === 1 ? gold : '#fff6d8',
    dur: 5 + ((i * 23) % 40) / 10,
    delay: ((i * 31) % 60) / 10,
    rot: (i * 47) % 360,
    diamond: i % 2 === 0,
  }));

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ opacity: on ? 1 : 0, transition: 'opacity 900ms ease' }}>
      <svg viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id="st-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a1206" />
            <stop offset="0.5" stopColor="#140d04" />
            <stop offset="1" stopColor="#0a0702" />
          </linearGradient>
          <linearGradient id="st-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={gold} stopOpacity="0.35" />
            <stop offset="1" stopColor={gold} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="st-beam2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.3" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="st-floor" cx="50%" cy="100%" r="70%">
            <stop offset="0" stopColor={gold} stopOpacity="0.32" />
            <stop offset="0.5" stopColor={accent} stopOpacity="0.1" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1100" height="640" fill="url(#st-bg)" />

        {/* crossing spotlight beams from the top */}
        <g>
          <polygon points="330,-20 470,-20 760,660 40,660" fill="url(#st-beam)">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="4s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="rotate" values="-4 400 0; 4 400 0; -4 400 0" dur="7s" repeatCount="indefinite" />
          </polygon>
          <polygon points="630,-20 770,-20 1060,660 340,660" fill="url(#st-beam2)">
            <animate attributeName="opacity" values="1;0.6;1" dur="4.6s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="rotate" values="5 700 0; -5 700 0; 5 700 0" dur="8s" repeatCount="indefinite" />
          </polygon>
        </g>

        {/* stage floor glow */}
        <ellipse cx="550" cy="640" rx="620" ry="150" fill="url(#st-floor)" />
        <rect x="0" y="574" width="1100" height="4" fill={accent} opacity="0.5" />

        {/* shimmering glitter scattering down */}
        {glitter.map((g, i) => (
          <g key={i} opacity="0">
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${g.dur}s`} begin={`${g.delay}s`} repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values={`${g.x},${g.startY}; ${g.x - 30},660`} dur={`${g.dur}s`} begin={`${g.delay}s`} repeatCount="indefinite" additive="sum" />
            {g.diamond ? (
              <g transform={`rotate(${g.rot})`}>
                <rect x={-g.size / 2} y={-g.size / 2} width={g.size} height={g.size} fill={g.color} transform="rotate(45)">
                  <animate attributeName="opacity" values="0.4;1;0.4" dur="1.3s" begin={`${g.delay}s`} repeatCount="indefinite" />
                </rect>
              </g>
            ) : (
              <path d={`M 0 ${-g.size} L ${g.size * 0.3} ${-g.size * 0.3} L ${g.size} 0 L ${g.size * 0.3} ${g.size * 0.3} L 0 ${g.size} L ${-g.size * 0.3} ${g.size * 0.3} L ${-g.size} 0 L ${-g.size * 0.3} ${-g.size * 0.3} Z`} fill={g.color}>
                <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" begin={`${g.delay}s`} repeatCount="indefinite" />
              </path>
            )}
          </g>
        ))}

        {/* accent sparkle highlight near the top */}
        <circle cx="550" cy="70" r="150" fill={accent2} opacity="0.06" />

        <style>{`@media (prefers-reduced-motion: reduce){svg animate,svg animateTransform{animation:none!important;}}`}</style>
      </svg>
    </div>
  );
}
