'use client';

// "Lucky Era" — glowing pastel hearts, stars, moons and four-leaf clovers floating and sparkling.
// Original SVG art (no external assets).

const COLORS: Record<string, string> = { heart: '#ffb3d1', star: '#ffe9a8', moon: '#cbb6ff', clover: '#a8e6b0' };
const TYPES = ['heart', 'star', 'moon', 'clover'];

const ICONS = Array.from({ length: 16 }, (_, i) => ({
  x: 70 + ((i * 173) % 980),
  y: 60 + ((i * 227) % 520),
  s: 0.7 + ((i * 11) % 12) / 10,
  type: TYPES[i % 4],
  bob: 8 + ((i * 7) % 10),
  sway: 6 + ((i * 5) % 10),
  dur: 5.5 + ((i * 9) % 40) / 10,
  delay: (i * 0.9) % 6,
  tw: 2.6 + ((i * 7) % 24) / 10,
}));

const SPARKLES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 311) % 1100,
  y: (i * 197) % 640,
  s: 0.5 + ((i * 13) % 10) / 10,
  dur: 1.8 + ((i * 7) % 22) / 10,
  delay: ((i * 17) % 40) / 10,
}));

function Shape({ type }: { type: string }) {
  if (type === 'heart') return <path d="M0 3 C -4 -5, -14 0, 0 12 C 14 0, 4 -5, 0 3 Z" fill={COLORS.heart} />;
  if (type === 'star') return <path d="M 0 -11 L 3.4 -3.4 L 10.5 -3.4 L 4.3 1.3 L 6.7 8.9 L 0 4.5 L -6.7 8.9 L -4.3 1.3 L -10.5 -3.4 L -3.4 -3.4 Z" fill={COLORS.star} />;
  if (type === 'moon') return <path d="M 3 -9.5 A 10 10 0 1 0 3 9.5 A 7.5 7.5 0 1 1 3 -9.5 Z" fill={COLORS.moon} />;
  return (
    <g>
      <g fill={COLORS.clover}>
        <circle cx="0" cy="-5" r="5" />
        <circle cx="5" cy="1" r="5" />
        <circle cx="-5" cy="1" r="5" />
        <circle cx="0" cy="5" r="4.5" />
      </g>
      <rect x="-0.8" y="7" width="1.6" height="7" fill="#7bc98a" />
    </g>
  );
}

export default function LuckyEraEffect() {
  return (
    <div
      className="we-root pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'radial-gradient(700px 520px at 18% 18%, rgba(168,230,176,0.16), transparent 60%),' +
          'radial-gradient(720px 540px at 82% 26%, rgba(255,179,209,0.16), transparent 62%),' +
          'radial-gradient(760px 620px at 50% 104%, rgba(203,182,255,0.15), transparent 60%),' +
          'linear-gradient(180deg, #151029, #100b20)',
      }}
    >
      <style>{`
        @keyframes weReveal { from{opacity:0} to{opacity:1} }
        .we-root { animation: weReveal 1.4s ease-out both; }
      `}</style>
      <svg width="100%" height="100%" viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
        {/* sparkle glints */}
        {SPARKLES.map((s, i) => (
          <path key={i} d="M0 -5 L1 -1 L5 0 L1 1 L0 5 L-1 1 L-5 0 L-1 -1 Z" fill="#fff6fb" transform={`translate(${s.x} ${s.y}) scale(${s.s})`}>
            <animate attributeName="opacity" values="0;1;0" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </path>
        ))}

        {/* floating pastel charms */}
        {ICONS.map((it, i) => (
          <g key={i} transform={`translate(${it.x} ${it.y})`}>
            <g>
              <animateTransform attributeName="transform" type="translate" values={`0 ${it.bob}; ${it.sway} -${it.bob}; 0 ${it.bob}`} dur={`${it.dur}s`} begin={`${it.delay}s`} repeatCount="indefinite" />
              <g style={{ filter: `drop-shadow(0 0 5px ${COLORS[it.type]}) drop-shadow(0 0 9px ${COLORS[it.type]}88)` }}>
                <animateTransform attributeName="transform" type="rotate" values="-9;9;-9" dur={`${(it.dur * 1.4).toFixed(1)}s`} begin={`${it.delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.75;1;0.75" dur={`${it.tw}s`} begin={`${it.delay}s`} repeatCount="indefinite" />
                <g transform={`scale(${it.s})`}>
                  <Shape type={it.type} />
                </g>
              </g>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
