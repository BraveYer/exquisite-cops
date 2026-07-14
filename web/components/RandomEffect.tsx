'use client';

import { useEffect, useState } from 'react';

// "hehe so random xP" — original recreation of the 2000s scene aesthetic:
// a black & white checkerboard with chaotic icons (cat skulls, hearts, stars,
// bolts) wiggling and spinning everywhere.
export default function RandomEffect() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 30);
    return () => clearTimeout(t);
  }, []);

  const COLORS = ['#ff3ea5', '#b6ff3e', '#3ee8ff', '#ffe83e', '#ffffff'];

  // Icon path builders (drawn around 0,0 in a ~ -14..14 box).
  const ICONS: Record<string, JSX.Element> = {
    catskull: (
      <g>
        <path d="M -13 -6 L -8 -14 L -3 -7 Z M 13 -6 L 8 -14 L 3 -7 Z" />
        <path d="M 0 -10 C 10 -10 12 -2 12 4 C 12 10 7 13 0 13 C -7 13 -12 10 -12 4 C -12 -2 -10 -10 0 -10 Z" />
        <g fill="#000">
          <circle cx="-5" cy="1" r="2.6" />
          <circle cx="5" cy="1" r="2.6" />
          <path d="M 0 5 l 3 5 l -6 0 Z" />
        </g>
      </g>
    ),
    heart: <path d="M 0 12 C -14 2 -11 -10 -3 -8 C -1 -7.5 0 -6 0 -5 C 0 -6 1 -7.5 3 -8 C 11 -10 14 2 0 12 Z" />,
    star: <path d="M 0 -13 L 3.8 -4 L 13 -3.5 L 6 3 L 8 12 L 0 7 L -8 12 L -6 3 L -13 -3.5 L -3.8 -4 Z" />,
    bolt: <path d="M 3 -13 L -8 3 L -1 3 L -4 13 L 9 -4 L 1 -4 Z" />,
    skull: (
      <g>
        <path d="M 0 -12 C 9 -12 12 -5 12 2 C 12 7 9 9 8 12 L -8 12 C -9 9 -12 7 -12 2 C -12 -5 -9 -12 0 -12 Z" />
        <g fill="#000">
          <circle cx="-5" cy="0" r="3" />
          <circle cx="5" cy="0" r="3" />
          <rect x="-1.5" y="5" width="3" height="4" />
        </g>
      </g>
    ),
    swirl: <path d="M 0 -11 A 11 11 0 1 1 -8 8 A 8 8 0 1 0 6 3 A 5 5 0 1 1 -2 -1" fill="none" strokeWidth="3" />,
    xeyes: (
      <g fill="none" strokeWidth="3" strokeLinecap="round">
        <circle cx="0" cy="0" r="12" />
        <path d="M -7 -4 l 4 4 M -3 -4 l -4 4 M 3 -4 l 4 4 M 7 -4 l -4 4 M -5 6 q 5 4 10 0" />
      </g>
    ),
    peace: (
      <g fill="none" strokeWidth="2.5">
        <circle cx="0" cy="0" r="12" />
        <path d="M 0 -12 L 0 12 M 0 0 L -8 8 M 0 0 L 8 8" />
      </g>
    ),
  };

  const items = [
    { k: 'catskull', x: 130, y: 120, s: 1.5, c: 0, dur: 6, dir: 1 },
    { k: 'heart', x: 900, y: 140, s: 1.3, c: 0, dur: 5, dir: -1 },
    { k: 'star', x: 520, y: 90, s: 1.2, c: 3, dur: 7, dir: 1 },
    { k: 'bolt', x: 300, y: 380, s: 1.4, c: 3, dur: 4.5, dir: -1 },
    { k: 'skull', x: 780, y: 420, s: 1.5, c: 4, dir: 1, dur: 6.5 },
    { k: 'swirl', x: 180, y: 500, s: 1.3, c: 2, dur: 8, dir: 1 },
    { k: 'xeyes', x: 980, y: 330, s: 1.1, c: 1, dur: 5.5, dir: -1 },
    { k: 'heart', x: 60, y: 300, s: 0.9, c: 0, dur: 6, dir: 1 },
    { k: 'star', x: 660, y: 300, s: 1, c: 1, dur: 4.8, dir: -1 },
    { k: 'peace', x: 420, y: 470, s: 1.2, c: 2, dur: 7.5, dir: 1 },
    { k: 'bolt', x: 1010, y: 520, s: 1.1, c: 3, dur: 5, dir: 1 },
    { k: 'catskull', x: 610, y: 540, s: 1.1, c: 4, dur: 6, dir: -1 },
    { k: 'star', x: 250, y: 230, s: 0.8, c: 3, dur: 4, dir: 1 },
    { k: 'heart', x: 840, y: 250, s: 0.85, c: 0, dur: 5.2, dir: -1 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ opacity: on ? 1 : 0, transition: 'opacity 900ms ease' }}>
      <svg viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <pattern id="rnd-check" width="72" height="72" patternUnits="userSpaceOnUse">
            <rect width="72" height="72" fill="#0e0e0e" />
            <rect x="0" y="0" width="36" height="36" fill="#d8d8d8" />
            <rect x="36" y="36" width="36" height="36" fill="#d8d8d8" />
          </pattern>
          <radialGradient id="rnd-vig" cx="50%" cy="45%" r="75%">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        <rect width="1100" height="640" fill="url(#rnd-check)" opacity="0.5">
          <animateTransform attributeName="transform" type="translate" values="0 0; 72 72; 0 0" dur="12s" repeatCount="indefinite" />
        </rect>
        <rect width="1100" height="640" fill="url(#rnd-vig)" />

        {items.map((it, i) => {
          const col = COLORS[it.c];
          return (
            <g key={i} transform={`translate(${it.x} ${it.y})`}>
              <g>
                <animateTransform attributeName="transform" type="rotate" from={`0`} to={`${360 * it.dir}`} dur={`${it.dur}s`} repeatCount="indefinite" />
                <animateTransform attributeName="transform" type="translate" values="0 -6; 0 6; 0 -6" dur={`${it.dur * 0.7}s`} repeatCount="indefinite" additive="sum" />
                <g transform={`scale(${it.s})`} fill={col} stroke={col}>
                  {ICONS[it.k]}
                </g>
              </g>
            </g>
          );
        })}

        <style>{`@media (prefers-reduced-motion: reduce){svg animateTransform{animation:none!important;}}`}</style>
      </svg>
    </div>
  );
}
