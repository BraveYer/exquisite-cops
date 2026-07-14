'use client';

import { useRef, useState } from 'react';
import { Download, Share2, ImageIcon } from 'lucide-react';

type P = { copsName?: string; discordId?: string };

const clip = (s: string, n = 14) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const MAP_ACCENT: Record<string, string> = {
  Bureau: '#f59e0b',
  Grounded: '#84cc16',
  Legacy: '#a78bfa',
  Port: '#06b6d4',
  Canals: '#3b82f6',
  Raid: '#ef4444',
  Plaza: '#ec4899',
};

export default function ResultCard({ matchId, map, winner, teamA, teamB }: { matchId: string; map: string; winner?: 'A' | 'B'; teamA: P[]; teamB: P[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);

  const namesA = teamA.slice(0, 5).map((p) => clip(p.copsName || 'Unknown'));
  const namesB = teamB.slice(0, 5).map((p) => clip(p.copsName || 'Unknown'));
  const aWon = winner === 'A';
  const bWon = winner === 'B';
  const cyan = '#22d3ee';
  const pink = '#e879f9';
  const accent = MAP_ACCENT[map] || '#22d3ee';
  const mapImg = `/maps/${(map || '').toLowerCase()}.jpg`;

  // Load the map image (same-origin, so the canvas is NOT tainted and export works).
  const loadMap = (): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = mapImg;
    });

  const toPng = async (): Promise<Blob | null> => {
    const svg = svgRef.current;
    if (!svg) return null;
    const mapImage = await loadMap();

    const xml = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));

    return new Promise((resolve) => {
      const overlay = new Image();
      overlay.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = 525;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        // Base
        ctx.fillStyle = '#0a0a0e';
        ctx.fillRect(0, 0, 1000, 525);
        // Map image, cover-fit
        if (mapImage && mapImage.width) {
          const scale = Math.max(1000 / mapImage.width, 525 / mapImage.height);
          const dw = mapImage.width * scale;
          const dh = mapImage.height * scale;
          ctx.drawImage(mapImage, (1000 - dw) / 2, (525 - dh) / 2, dw, dh);
        }
        // SVG (dark overlay + content) on top
        ctx.drawImage(overlay, 0, 0, 1000, 525);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob((b) => resolve(b), 'image/png');
      };
      overlay.onerror = () => resolve(null);
      overlay.src = svgUrl;
    });
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await toPng();
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `exquisitecops-match-${matchId}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await toPng();
      const file = blob ? new File([blob], `match-${matchId}.png`, { type: 'image/png' }) : null;
      const nav = navigator as any;
      if (file && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'Exquisite COPS — Match result' });
      } else {
        await download();
      }
    } catch {
      /* cancelled */
    } finally {
      setBusy(false);
    }
  };

  const col = (x: number, label: string, names: string[], teamAccent: string, won: boolean) => (
    <g>
      {won && <rect x={x - 10} y={110} width={380} height={330} rx={18} fill="#000000" fillOpacity={0.25} stroke={teamAccent} strokeWidth={3} />}
      <text x={x + 180} y={150} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={26} fontWeight="bold" fill={teamAccent}>
        {label}
      </text>
      {won && (
        <text x={x + 180} y={182} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={16} fontWeight="bold" fill="#fde047" letterSpacing="3">
          ★ WINNER ★
        </text>
      )}
      {names.map((n, i) => (
        <text key={i} x={x + 180} y={230 + i * 40} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={22} fontWeight={won ? 'bold' : 'normal'} fill={won ? '#ffffff' : '#cbd5e1'}>
          {n}
        </text>
      ))}
    </g>
  );

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-4 flex items-center gap-2">
        <ImageIcon size={18} className="text-cyan-400" />
        <h3 className="text-lg font-black text-white">Share result</h3>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0e]">
        {/* Map image preview behind the SVG overlay */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${mapImg})` }} />
        <svg ref={svgRef} viewBox="0 0 1000 525" width="1000" height="525" xmlns="http://www.w3.org/2000/svg" className="relative h-auto w-full">
          <defs>
            <linearGradient id="ov" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#08080c" stopOpacity="0.55" />
              <stop offset="0.5" stopColor="#08080c" stopOpacity="0.72" />
              <stop offset="1" stopColor="#08080c" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <rect width="1000" height="525" fill="url(#ov)" />
          <rect x="0" y="0" width="1000" height="6" fill={accent} />
          <text x="40" y="60" fontFamily="Arial, sans-serif" fontSize={30} fontWeight="bold" fill={accent} letterSpacing="1">
            EXQUISITE COPS
          </text>
          <text x="40" y="88" fontFamily="Arial, sans-serif" fontSize={16} fill="#9ca3af" letterSpacing="4">
            MATCH RESULT
          </text>
          <text x="960" y="60" textAnchor="end" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="bold" fill="#ffffff">
            {clip(map || 'Unknown', 18)}
          </text>
          <text x="960" y="86" textAnchor="end" fontFamily="Arial, sans-serif" fontSize="14" fill="#9ca3af" letterSpacing="2">
            MAP
          </text>

          {col(40, 'TEAM A', namesA, cyan, aWon)}
          <text x="500" y="300" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="34" fontWeight="bold" fill="#e5e7eb">
            VS
          </text>
          {col(580, 'TEAM B', namesB, pink, bWon)}

          <text x="500" y="500" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="15" fill="#9ca3af">
            exquisitecops.netlify.app
          </text>
        </svg>
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={share} disabled={busy} className="flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:opacity-50">
          <Share2 size={15} /> Share
        </button>
        <button onClick={download} disabled={busy} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-gray-300 hover:text-white disabled:opacity-50">
          <Download size={15} /> Download PNG
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-600">Map backgrounds: drop images in <code>public/maps/</code> named like <code>{(map || 'mapname').toLowerCase()}.jpg</code>.</p>
    </div>
  );
}
