'use client';

// "Enchanted Cosmos" — dreamy pink/purple nebula with glowing planets, rising bubbles and a rainbow comet.
// Original SVG art (no external assets).

const STARS = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 271) % 1100,
  y: (i * 397) % 640,
  r: 0.8 + ((i * 13) % 10) / 8,
  dur: 2.2 + ((i * 7) % 30) / 10,
  delay: ((i * 17) % 40) / 10,
}));

const BUBBLES = Array.from({ length: 8 }, (_, i) => ({
  x: 80 + ((i * 137) % 960),
  r: 10 + ((i * 11) % 26),
  dur: 11 + ((i * 5) % 9),
  delay: (i * 1.7) % 12,
}));

export default function CosmosEffect() {
  return (
    <div
      className="we-root pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'radial-gradient(900px 620px at 18% 12%, rgba(255,110,199,0.22), transparent 60%),' +
          'radial-gradient(1000px 700px at 85% 22%, rgba(150,110,255,0.24), transparent 62%),' +
          'radial-gradient(760px 620px at 60% 108%, rgba(120,200,255,0.16), transparent 60%),' +
          'linear-gradient(180deg, #0d0620, #0a0416)',
      }}
    >
      <style>{`
        @keyframes weReveal { from{opacity:0} to{opacity:1} }
        .we-root { animation: weReveal 1.4s ease-out both; }
      `}</style>
      <svg width="100%" height="100%" viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="cos-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="cos-p1" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#ffd0ec" /><stop offset="45%" stopColor="#ff6ec7" /><stop offset="100%" stopColor="#a0247f" />
          </radialGradient>
          <radialGradient id="cos-p2" cx="40%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#d8c6ff" /><stop offset="50%" stopColor="#8f6bff" /><stop offset="100%" stopColor="#3a1f80" />
          </radialGradient>
          <radialGradient id="cos-p3" cx="40%" cy="36%" r="70%">
            <stop offset="0%" stopColor="#c8f4ff" /><stop offset="50%" stopColor="#57c8ff" /><stop offset="100%" stopColor="#1d5a8a" />
          </radialGradient>
          <linearGradient id="cos-rainbow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff5a5a" stopOpacity="0" />
            <stop offset="35%" stopColor="#ffd84d" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#4dff9e" stopOpacity="0.75" />
            <stop offset="82%" stopColor="#4dc8ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
          <radialGradient id="cos-bub" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#ffb8ec" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#a97bff" stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* stars */}
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff0fb">
            <animate attributeName="opacity" values="0.25;1;0.25" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* planets */}
        <g filter="url(#cos-glow)">
          <circle cx="220" cy="150" r="46" fill="url(#cos-p1)">
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 -14; 0 0" dur="9s" repeatCount="indefinite" additive="sum" />
          </circle>
          <g>
            <circle cx="880" cy="200" r="60" fill="url(#cos-p2)" />
            <ellipse cx="880" cy="200" rx="92" ry="24" fill="none" stroke="#e8dcff" strokeOpacity="0.5" strokeWidth="4" transform="rotate(-18 880 200)" />
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 12; 0 0" dur="11s" repeatCount="indefinite" additive="sum" />
          </g>
          <circle cx="600" cy="470" r="30" fill="url(#cos-p3)">
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="8s" repeatCount="indefinite" additive="sum" />
          </circle>
        </g>

        {/* bubbles rising */}
        {BUBBLES.map((b, i) => (
          <circle key={i} cx={b.x} cy="700" r={b.r} fill="url(#cos-bub)" stroke="#ffd6f5" strokeOpacity="0.25" strokeWidth="1">
            <animateTransform attributeName="transform" type="translate" values="0 0; -30 -760" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.8;0.8;0" keyTimes="0;0.1;0.85;1" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* rainbow comet — streaks across, then waits before looping */}
        <g filter="url(#cos-glow)">
          <g>
            <animateTransform attributeName="transform" type="translate" values="-260 620; -260 620; 1360 -60; 1360 -60" keyTimes="0;0.12;0.42;1" dur="9s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.12;0.16;0.38;0.42;1" dur="9s" repeatCount="indefinite" />
            <g transform="rotate(-24)">
              <rect x="0" y="-4" width="230" height="8" rx="4" fill="url(#cos-rainbow)" />
              <circle cx="232" cy="0" r="7" fill="#ffffff" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
