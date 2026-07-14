'use client';

// Original recreation of a "Counting Sheep" slumber theme: a starry night with a
// pink-yellow crescent moon and white sheep leaping across in gentle arcs.
export default function CountingSheepEffect() {
  const stars = Array.from({ length: 30 }, (_, i) => ({
    x: (i * 137) % 1100,
    y: (i * 73) % 430,
    r: 0.8 + ((i * 7) % 3) * 0.5,
    d: 2 + ((i * 5) % 4),
    delay: (i % 6) * 0.4,
  }));

  const sheep = [
    { path: 'M -160,470 Q 220,300 600,470 T 1320,470', dur: 9, delay: 0, scale: 1 },
    { path: 'M -220,520 Q 260,360 640,520 T 1360,520', dur: 11, delay: 3.5, scale: 0.8 },
    { path: 'M -260,430 Q 300,270 680,430 T 1400,430', dur: 13, delay: 6.5, scale: 0.62 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <style>{`
        @keyframes csReveal { from { opacity: 0 } to { opacity: 1 } }
        .cs-wrap { animation: csReveal 1.1s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .cs-wrap animate, .cs-wrap animateTransform, .cs-wrap animateMotion { animation: none; }
        }
      `}</style>
      <svg className="cs-wrap h-full w-full" viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="csSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a1140" />
            <stop offset="0.5" stopColor="#2b1a52" />
            <stop offset="1" stopColor="#3a1e54" />
          </linearGradient>
          <radialGradient id="csMoon" cx="35%" cy="35%" r="70%">
            <stop offset="0" stopColor="#fff2c4" />
            <stop offset="0.55" stopColor="#ffcf8f" />
            <stop offset="1" stopColor="#ff9ec4" />
          </radialGradient>
          <radialGradient id="csGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffd6ec" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffd6ec" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="csHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#241246" />
            <stop offset="1" stopColor="#1a0e38" />
          </linearGradient>
        </defs>

        <rect width="1100" height="640" fill="url(#csSky)" />

        {/* stars */}
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff4d6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur={`${s.d}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* crescent moon (glow + disc + bite) */}
        <circle cx="880" cy="150" r="120" fill="url(#csGlow)" />
        <circle cx="880" cy="150" r="66" fill="url(#csMoon)" />
        <circle cx="912" cy="132" r="60" fill="#2b1a52" />
        {/* little sparkles by the moon */}
        <g fill="#fff2c4">
          <path d="M 790 90 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 z">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
          </path>
          <path d="M 960 250 l 2.5 6 l 6 2.5 l -6 2.5 l -2.5 6 l -2.5 -6 l -6 -2.5 l 6 -2.5 z">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2.4s" begin="0.7s" repeatCount="indefinite" />
          </path>
        </g>

        {/* meadow hills */}
        <path d="M 0 560 Q 275 500 550 555 T 1100 545 L 1100 640 L 0 640 Z" fill="url(#csHill)" />
        <path d="M 0 600 Q 300 560 620 600 T 1100 590 L 1100 640 L 0 640 Z" fill="#160c30" opacity="0.8" />

        {/* leaping sheep */}
        {sheep.map((s, i) => (
          <g key={i}>
            <g transform={`scale(${s.scale})`}>
              {/* sheep body */}
              <g>
                {/* legs */}
                <rect x="-14" y="6" width="4" height="12" rx="2" fill="#e9e2f5" />
                <rect x="-4" y="8" width="4" height="12" rx="2" fill="#e9e2f5" />
                <rect x="6" y="8" width="4" height="12" rx="2" fill="#e9e2f5" />
                <rect x="14" y="6" width="4" height="12" rx="2" fill="#e9e2f5" />
                {/* fluffy body */}
                <ellipse cx="0" cy="0" rx="22" ry="16" fill="#ffffff" />
                <circle cx="-14" cy="-6" r="9" fill="#ffffff" />
                <circle cx="-4" cy="-11" r="9" fill="#ffffff" />
                <circle cx="7" cy="-10" r="9" fill="#ffffff" />
                <circle cx="16" cy="-5" r="8" fill="#ffffff" />
                <circle cx="12" cy="6" r="8" fill="#ffffff" />
                <circle cx="-12" cy="6" r="8" fill="#ffffff" />
                {/* head */}
                <ellipse cx="22" cy="-2" rx="8" ry="9" fill="#3a2f4a" />
                <circle cx="20" cy="-9" r="3" fill="#3a2f4a" />
                <circle cx="27" cy="-8" r="3" fill="#3a2f4a" />
                <circle cx="24" cy="-4" r="1.6" fill="#fff" />
              </g>
              <animateMotion path={s.path} dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" rotate="0" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
