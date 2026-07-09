'use client';

// "Falling Stars" — glowing stars streak down from the night sky and submerge into a dark ocean,
// each leaving an expanding ripple on the water. Original SVG art (no external assets).

const WATER = 400; // water line in the 0..640 viewBox

const SKY_STARS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 311) % 1100,
  y: (i * 173) % (WATER - 40),
  r: 0.7 + ((i * 13) % 8) / 8,
  dur: 2.4 + ((i * 7) % 26) / 10,
  delay: ((i * 19) % 40) / 10,
}));

const FALLERS = Array.from({ length: 7 }, (_, i) => ({
  x: 90 + ((i * 149) % 960),
  dur: 5.5 + ((i * 7) % 30) / 10,
  delay: (i * 1.35) % 9,
}));

export default function FallingStarsEffect() {
  return (
    <div
      className="we-root pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'radial-gradient(700px 300px at 50% 62%, rgba(120,170,255,0.10), transparent 70%),' +
          'linear-gradient(180deg, #0a1030 0%, #0b1338 40%, #081026 62%, #050b1e 63%, #03071a 100%)',
      }}
    >
      <style>{`
        @keyframes weReveal { from{opacity:0} to{opacity:1} }
        .we-root { animation: weReveal 1.4s ease-out both; }
      `}</style>
      <svg width="100%" height="100%" viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="fs-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="fs-trail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bcd8ff" stopOpacity="0" />
            <stop offset="100%" stopColor="#eaf4ff" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="fs-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1740" stopOpacity="0.0" />
            <stop offset="8%" stopColor="#12336e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#03071a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* sky stars */}
        {SKY_STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#eaf2ff">
            <animate attributeName="opacity" values="0.2;1;0.2" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* water surface sheen */}
        <rect x="0" y={WATER - 30} width="1100" height="120" fill="url(#fs-water)" />
        <line x1="0" y1={WATER} x2="1100" y2={WATER} stroke="#5a86c8" strokeOpacity="0.18" strokeWidth="1" />

        {/* falling stars + ripples */}
        {FALLERS.map((f, i) => (
          <g key={i} filter="url(#fs-glow)">
            <g>
              <animateTransform attributeName="transform" type="translate" values={`${f.x} -50; ${f.x} ${WATER}; ${f.x} ${WATER}`} keyTimes="0;0.4;1" dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.05;0.34;0.42;1" dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
              <rect x="-1.5" y="-42" width="3" height="36" fill="url(#fs-trail)" />
              <path d="M 0 -9 L 2.2 -2.2 L 9 0 L 2.2 2.2 L 0 9 L -2.2 2.2 L -9 0 L -2.2 -2.2 Z" fill="#f2f8ff" />
            </g>
            <ellipse cx={f.x} cy={WATER} rx="3" ry="1" fill="none" stroke="#cfe4ff" strokeWidth="1.6">
              <animate attributeName="rx" values="3;3;70;3" keyTimes="0;0.4;0.64;1" dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
              <animate attributeName="ry" values="1;1;19;1" keyTimes="0;0.4;0.64;1" dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0;0.7;0;0" keyTimes="0;0.4;0.43;0.64;1" dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
            </ellipse>
          </g>
        ))}
      </svg>
    </div>
  );
}
