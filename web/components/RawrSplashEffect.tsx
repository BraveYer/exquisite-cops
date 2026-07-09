'use client';

// "Rawr xD Splash" — hot-pink "RAWR XD!" with flashing lightning and neon-green paint splatters.
// Original SVG art (no external assets).

const SPLATS = Array.from({ length: 8 }, (_, i) => ({
  x: 90 + ((i * 197) % 940),
  y: 70 + ((i * 251) % 500),
  a: (i * 47) % 360,
  s: 0.8 + ((i * 11) % 14) / 10,
  dur: 3.2 + ((i * 7) % 26) / 10,
  delay: (i * 0.8) % 6,
}));

const BOLTS = Array.from({ length: 4 }, (_, i) => ({
  x: 180 + ((i * 233) % 780),
  y: 40 + ((i * 91) % 120),
  a: -12 + ((i * 13) % 24),
  s: 0.9 + ((i * 5) % 8) / 10,
  dur: 2.4 + ((i * 9) % 20) / 10,
  delay: (i * 1.1) % 5,
}));

const SPLAT = 'M 0 -22 C 8 -18 10 -8 18 -10 C 14 -2 23 2 20 8 C 12 8 15 19 6 18 C 4 12 -4 21 -8 14 C -6 8 -19 12 -16 4 C -10 2 -18 -6 -12 -10 C -6 -8 -8 -19 0 -22 Z';
const BOLT = 'M 6 0 L -7 34 L 2 32 L -9 66 L 15 26 L 4 28 L 13 0 Z';

export default function RawrSplashEffect() {
  return (
    <div
      className="we-root pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'radial-gradient(680px 520px at 22% 24%, rgba(255,45,149,0.16), transparent 60%),' +
          'radial-gradient(680px 520px at 78% 70%, rgba(92,255,92,0.12), transparent 62%),' +
          'linear-gradient(140deg, #16001b, #1c0014)',
      }}
    >
      <style>{`
        @keyframes weReveal { from{opacity:0} to{opacity:1} }
        .we-root { animation: weReveal 1.2s ease-out both; }
      `}</style>
      <svg width="100%" height="100%" viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
        {/* neon green splatters */}
        {SPLATS.map((sp, i) => (
          <g key={i} transform={`translate(${sp.x} ${sp.y}) rotate(${sp.a})`} style={{ filter: 'drop-shadow(0 0 6px #5cff5c) drop-shadow(0 0 12px #5cff5c88)' }}>
            <g>
              <animateTransform attributeName="transform" type="scale" values="0.2;1.15;1;1;0.2" keyTimes="0;0.12;0.2;0.86;1" dur={`${sp.dur}s`} begin={`${sp.delay}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;1;1;0" keyTimes="0;0.1;0.2;0.86;1" dur={`${sp.dur}s`} begin={`${sp.delay}s`} repeatCount="indefinite" />
              <g transform={`scale(${sp.s})`} fill="#66ff66">
                <path d={SPLAT} />
                <circle cx="24" cy="-12" r="3.2" />
                <circle cx="-20" cy="18" r="2.6" />
                <circle cx="16" cy="22" r="2.2" />
                <circle cx="-24" cy="-6" r="2.4" />
              </g>
            </g>
          </g>
        ))}

        {/* lightning flashes */}
        {BOLTS.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.a}) scale(${b.s})`} fill="#fff2fb" style={{ filter: 'drop-shadow(0 0 5px #ffffff) drop-shadow(0 0 11px #ff2d95)' }}>
            <path d={BOLT} />
            <animate attributeName="opacity" values="0;0;1;0.1;1;0;0" keyTimes="0;0.34;0.37;0.42;0.47;0.53;1" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
          </g>
        ))}

        {/* RAWR XD! */}
        <g style={{ filter: 'drop-shadow(0 0 8px #ff2d95) drop-shadow(0 0 18px #ff2d9599)' }}>
          <animateTransform attributeName="transform" type="rotate" values="-3 550 150; 3 550 150; -3 550 150" dur="1.9s" repeatCount="indefinite" />
          <text x="550" y="185" textAnchor="middle" fontSize="128" fontWeight="900" fontStyle="italic" fill="#ff2d95" stroke="#2a0016" strokeWidth="3" style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '-3px' }}>
            RAWR XD!
          </text>
        </g>
      </svg>
    </div>
  );
}
