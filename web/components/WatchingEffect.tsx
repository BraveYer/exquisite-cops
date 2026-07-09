'use client';

// "Always Watching" — a glossy black ooze seeps in; sinister glowing faces (eyes + toothy grins)
// emerge from behind it. All original SVG (feTurbulence-driven liquid + hand-drawn faces).

const FACES = [
  { x: 150, y: 80, s: 0.8, peak: 0.95, dur: 8.0, delay: 0.2, blink: 4.2 },
  { x: 380, y: 55, s: 0.55, peak: 0.7, dur: 9.5, delay: 1.6, blink: 5.6 },
  { x: 600, y: 100, s: 1.0, peak: 1.0, dur: 8.6, delay: 3.0, blink: 3.7 },
  { x: 820, y: 60, s: 0.6, peak: 0.72, dur: 10.2, delay: 0.8, blink: 6.1 },
  { x: 970, y: 120, s: 0.75, peak: 0.85, dur: 7.9, delay: 2.3, blink: 4.9 },
  { x: 80, y: 300, s: 0.65, peak: 0.78, dur: 9.6, delay: 4.1, blink: 5.2 },
  { x: 320, y: 360, s: 0.9, peak: 0.95, dur: 8.7, delay: 1.9, blink: 3.4 },
  { x: 560, y: 330, s: 0.5, peak: 0.6, dur: 11.0, delay: 0.4, blink: 6.5 },
  { x: 780, y: 390, s: 0.7, peak: 0.82, dur: 7.3, delay: 3.6, blink: 4.6 },
  { x: 980, y: 350, s: 0.85, peak: 0.92, dur: 9.1, delay: 2.7, blink: 3.9 },
  { x: 220, y: 540, s: 0.6, peak: 0.7, dur: 10.6, delay: 1.1, blink: 5.8 },
  { x: 470, y: 570, s: 0.78, peak: 0.88, dur: 8.1, delay: 4.4, blink: 4.1 },
  { x: 700, y: 545, s: 0.55, peak: 0.66, dur: 9.8, delay: 0.9, blink: 6.3 },
  { x: 900, y: 575, s: 0.8, peak: 0.9, dur: 7.7, delay: 2.5, blink: 4.4 },
];

function Face() {
  return (
    <g className="we-inner">
      {/* eyes — angled inward for a menacing look */}
      <g className="we-eyes">
        <g transform="translate(-32 0) rotate(14)">
          <path d="M -17 0 Q 0 -10 17 0 Q 0 10 -17 0 Z" fill="#fff6d8" />
          <ellipse cx="0" cy="0" rx="4.5" ry="9" fill="#0a0806" />
        </g>
        <g transform="translate(32 0) rotate(-14)">
          <path d="M -17 0 Q 0 -10 17 0 Q 0 10 -17 0 Z" fill="#fff6d8" />
          <ellipse cx="0" cy="0" rx="4.5" ry="9" fill="#0a0806" />
        </g>
      </g>
      {/* sinister toothy grin */}
      <path d="M -54 30 Q 0 88 54 30 Q 27 46 0 48 Q -27 46 -54 30 Z" fill="#fff2cf" />
      {/* pointed top teeth */}
      <path d="M -46 33 L -38 47 L -30 34 L -22 50 L -14 35 L -7 51 L 0 36 L 7 51 L 14 35 L 22 50 L 30 34 L 38 47 L 46 33"
        fill="none" stroke="#0b0a08" strokeWidth="2.2" strokeLinejoin="round" />
    </g>
  );
}

export default function WatchingEffect() {
  return (
    <div className="we-root pointer-events-none fixed inset-0 z-0" style={{ background: '#040406' }}>
      <style>{`
        @keyframes weReveal { from { opacity: 0; } to { opacity: 1; } }
        @keyframes weFade { 0%,100%{opacity:0} 16%,68%{opacity:var(--peak,.8)} }
        @keyframes weBlink { 0%,90%,100%{opacity:1} 94%{opacity:.05} }
        .we-root { animation: weReveal 1.6s ease-out both; }
        .we-face { animation: weFade var(--dur,8s) ease-in-out infinite; animation-delay: var(--delay,0s); filter: drop-shadow(0 0 3px #ffe6a6) drop-shadow(0 0 8px #ffcf6e); }
        .we-eyes { animation: weBlink var(--blink,5s) ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .we-root,.we-face,.we-eyes { animation: none; opacity: 1; } .we-face { opacity: var(--peak,.7); } }
      `}</style>
      <svg width="100%" height="100%" viewBox="0 0 1100 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {/* Glossy liquid: fractal-noise bump lit specularly = a wet, moving black ooze */}
          <filter id="we-ooze" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.016" numOctaves="4" seed="8" result="turb">
              <animate attributeName="baseFrequency" dur="26s" values="0.011 0.016;0.015 0.021;0.011 0.016" repeatCount="indefinite" />
            </feTurbulence>
            <feSpecularLighting in="turb" surfaceScale="5" specularConstant="0.95" specularExponent="16" lightingColor="#8a8ad0" result="spec">
              <fePointLight x="300" y="-60" z="220">
                <animate attributeName="x" dur="20s" values="220;820;220" repeatCount="indefinite" />
                <animate attributeName="y" dur="17s" values="-60;120;-60" repeatCount="indefinite" />
              </fePointLight>
            </feSpecularLighting>
          </filter>
          {/* denser at the top, fading downward */}
          <linearGradient id="we-mask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.15" />
          </linearGradient>
          <mask id="we-topmask"><rect width="1100" height="640" fill="url(#we-mask)" /></mask>
        </defs>

        {/* base darkness */}
        <rect width="1100" height="640" fill="#040406" />
        {/* faces emerging from the dark (behind the wet sheen) */}
        <g mask="url(#we-topmask)">
          {FACES.map((f, i) => (
            <g
              key={i}
              className="we-face"
              transform={`translate(${f.x} ${f.y}) scale(${f.s})`}
              style={{ ['--peak' as any]: f.peak, ['--dur' as any]: `${f.dur}s`, ['--delay' as any]: `${f.delay}s`, ['--blink' as any]: `${f.blink}s` }}
            >
              <Face />
            </g>
          ))}
        </g>
        {/* glossy liquid highlights on top */}
        <rect width="1100" height="640" filter="url(#we-ooze)" style={{ mixBlendMode: 'screen' }} opacity="0.55" mask="url(#we-topmask)" />
      </svg>
    </div>
  );
}
