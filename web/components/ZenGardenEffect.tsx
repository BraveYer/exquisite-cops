'use client';

// "Zen Garden" — a cybernetic Japanese garden & cityscape glitch and flicker into view under the moon.
// Original SVG art (no external assets): moon, neon skyline, torii gate, sakura + a chromatic-glitch pass.

const BUILDINGS = [
  { x: 20, w: 70, h: 150 }, { x: 96, w: 52, h: 240 }, { x: 154, w: 84, h: 190 },
  { x: 244, w: 60, h: 300 }, { x: 310, w: 76, h: 210 }, { x: 392, w: 54, h: 160 },
  { x: 726, w: 66, h: 200 }, { x: 798, w: 58, h: 280 }, { x: 862, w: 88, h: 175 },
  { x: 956, w: 60, h: 250 }, { x: 1022, w: 62, h: 185 },
];

const PETALS = Array.from({ length: 9 }, (_, i) => ({
  x: 120 + ((i * 179) % 900),
  s: 0.7 + ((i * 7) % 8) / 10,
  dur: 7 + ((i * 5) % 40) / 10,
  delay: (i * 1.3) % 8,
}));

function windows(b: { x: number; w: number; h: number }, gi: number) {
  const out: any[] = [];
  const top = 640 - b.h;
  let k = 0;
  for (let wy = top + 12; wy < 632; wy += 20) {
    for (let wx = b.x + 8; wx < b.x + b.w - 6; wx += 16) {
      k++;
      if ((gi * 7 + k * 13) % 5 === 0) continue;
      const lit = (gi * 3 + k * 7) % 3 === 0;
      out.push(<rect key={`${wx}-${wy}`} x={wx} y={wy} width="6" height="8" fill={lit ? '#7ff0ff' : '#123'} opacity={lit ? 0.9 : 0.5} />);
    }
  }
  return out;
}

export default function ZenGardenEffect() {
  return (
    <div
      className="we-root zen-root pointer-events-none fixed inset-0 z-0"
      style={{ background: 'radial-gradient(700px 460px at 62% 20%, rgba(120,200,255,0.14), transparent 62%), linear-gradient(180deg, #060a1a 0%, #0a1030 45%, #120a26 100%)' }}
    >
      <style>{`
        @keyframes weReveal { from{opacity:0} to{opacity:1} }
        @keyframes zenFlicker { 0%,100%{opacity:1} 46%{opacity:1} 47%{opacity:.35} 48%{opacity:1} 68%{opacity:1} 69%{opacity:.6} 70%{opacity:1} 82%{opacity:1} 83%{opacity:.5} 84%{opacity:1} }
        @keyframes zenJitter { 0%,7%,100%{transform:translateX(0)} 8%{transform:translateX(-6px)} 9%{transform:translateX(5px)} 10%{transform:translateX(0)} 51%{transform:translateX(0)} 52%{transform:translateX(6px)} 53%{transform:translateX(-4px)} 54%{transform:translateX(0)} }
        .zen-root { animation: weReveal 1.5s ease-out both, zenFlicker 6s steps(1,end) 1.5s infinite; }
        .zen-scene { animation: zenJitter 5.5s ease-in-out infinite; }
        .zen-scan { position:absolute; inset:0; background:repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px); mix-blend-mode:multiply; }
      `}</style>
      <svg width="100%" height="100%" viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="zen-chroma" x="-5%" y="-5%" width="110%" height="110%">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx="-2" dy="0" result="ro"><animate attributeName="dx" values="-1.5;-3.5;-1.5;-2;-1.5" dur="6s" repeatCount="indefinite" /></feOffset>
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="c" />
            <feOffset in="c" dx="2" dy="0" result="co"><animate attributeName="dx" values="1.5;3.5;1.5;2;1.5" dur="6s" repeatCount="indefinite" /></feOffset>
            <feBlend in="ro" in2="co" mode="screen" />
          </filter>
          <filter id="zen-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="zen-moon" cx="42%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#f2fbff" /><stop offset="60%" stopColor="#bfe6ff" /><stop offset="100%" stopColor="#6fa8d8" />
          </radialGradient>
        </defs>

        <g className="zen-scene" filter="url(#zen-chroma)">
          {/* moon */}
          <g filter="url(#zen-glow)">
            <circle cx="760" cy="150" r="82" fill="url(#zen-moon)" />
            <circle cx="742" cy="132" r="16" fill="#a9d4f0" opacity="0.5" />
            <circle cx="786" cy="168" r="10" fill="#a9d4f0" opacity="0.4" />
          </g>

          {/* city skyline + neon windows */}
          {BUILDINGS.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={640 - b.h} width={b.w} height={b.h} fill="#070c1a" stroke="#1a3a5a" strokeOpacity="0.4" />
              {windows(b, i)}
            </g>
          ))}

          {/* pagoda silhouette (center-left) */}
          <g fill="#0a1122" stroke="#2a5a7a" strokeOpacity="0.4">
            <rect x="470" y="470" width="60" height="170" />
            <polygon points="452,470 548,470 520,440 480,440" />
            <polygon points="462,440 538,440 516,414 484,414" />
            <polygon points="472,414 528,414 500,392 500,392" />
          </g>

          {/* torii gate (right, neon) */}
          <g fill="#ff3b6b" filter="url(#zen-glow)">
            <rect x="880" y="430" width="12" height="210" />
            <rect x="988" y="430" width="12" height="210" />
            <rect x="862" y="418" width="150" height="14" rx="3" />
            <rect x="872" y="452" width="130" height="10" />
          </g>

          {/* sakura branch + blossoms (upper left) */}
          <g stroke="#20344a" strokeWidth="5" fill="none" strokeLinecap="round">
            <path d="M -10 90 Q 120 70 210 130 M 120 78 Q 150 40 200 30 M 170 100 Q 210 96 250 70" />
          </g>
          <g fill="#ff8fc8" filter="url(#zen-glow)">
            {[[200, 30], [235, 46], [255, 66], [150, 40], [128, 66], [210, 128], [250, 70], [176, 96], [110, 82]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={5 + (i % 3)} />
            ))}
          </g>

          {/* falling petals */}
          {PETALS.map((p, i) => (
            <g key={i} fill="#ff9fd0" opacity="0.85">
              <ellipse cx={p.x} cy="-20" rx={5 * p.s} ry={3 * p.s}>
                <animateTransform attributeName="transform" type="translate" values={`0 0; -40 700`} dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.1;0.85;1" dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
              </ellipse>
            </g>
          ))}
        </g>
      </svg>
      <div className="zen-scan" />
    </div>
  );
}
