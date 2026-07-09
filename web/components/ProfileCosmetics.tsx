'use client';

import React, { useState, useRef, useCallback } from 'react';

// Injects the CSS for every cosmetic effect. Render once per page that shows cosmetics.
export function CosmeticStyles() {
  return (
    <style>{`
      .cos-frame-gold { border-radius:9999px; box-shadow:0 0 0 2px #fcd34d, 0 0 12px #f59e0b99; }
      .cos-frame-neon { border-radius:9999px; animation:cosNeon 1.8s ease-in-out infinite; }
      @keyframes cosNeon { 0%,100%{ box-shadow:0 0 0 2px #22d3ee, 0 0 10px #22d3ee88; } 50%{ box-shadow:0 0 0 2px #22d3ee, 0 0 22px #22d3ee; } }
      .cos-frame-ember { border-radius:9999px; animation:cosEmber 1.2s ease-in-out infinite; }
      @keyframes cosEmber { 0%,100%{ box-shadow:0 0 0 2px #f97316, 0 0 12px #f9731699; } 50%{ box-shadow:0 0 0 2px #fb923c, 0 0 20px #f97316cc; } }
      .cos-frame-rainbow { border-radius:9999px; animation:cosRainbow 3s linear infinite; }
      @keyframes cosRainbow {
        0%{ box-shadow:0 0 0 2px hsl(0,90%,60%), 0 0 16px hsl(0,90%,60%); }
        33%{ box-shadow:0 0 0 2px hsl(120,90%,60%), 0 0 16px hsl(120,90%,60%); }
        66%{ box-shadow:0 0 0 2px hsl(240,90%,65%), 0 0 16px hsl(240,90%,65%); }
        100%{ box-shadow:0 0 0 2px hsl(360,90%,60%), 0 0 16px hsl(360,90%,60%); }
      }
      .cos-name-gold { color:#fcd34d !important; text-shadow:0 0 10px #f59e0b66; }
      .cos-name-prism { background:linear-gradient(90deg,#22d3ee,#a78bfa,#f472b6,#22d3ee); background-size:200% auto; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; animation:cosPrism 4s linear infinite; }
      @keyframes cosPrism { to { background-position:200% center; } }
      .cos-name-glitch { animation:cosGlitch 1.8s infinite; }
      @keyframes cosGlitch {
        0%,100%{ text-shadow:none; transform:translate(0); }
        20%{ text-shadow:-2px 0 rgba(255,0,81,.6), 2px 0 rgba(0,229,255,.6); }
        40%{ text-shadow:2px 0 rgba(255,0,81,.6), -2px 0 rgba(0,229,255,.6); transform:translate(1px,-1px); }
        60%{ text-shadow:-1px 0 rgba(255,0,81,.85), 1px 0 rgba(0,229,255,.85); transform:translate(-1px,1px); }
        80%{ text-shadow:1px 0 rgba(255,0,81,.6), -1px 0 rgba(0,229,255,.6); }
      }
      .cos-theme-grid { background:linear-gradient(180deg,#0e1520,#0a0a0e); box-shadow:inset 0 0 70px -10px #22d3ee22; border:1px solid #22d3ee22; }
      .cos-theme-aurora { background:linear-gradient(120deg,#0b1020,#131024); box-shadow:inset 0 44px 90px -46px #22d3ee55, inset 0 -44px 90px -46px #a78bfa55; border:1px solid #ffffff12; }
      .cos-theme-ember { background:linear-gradient(180deg,#1a0f0a,#0a0a0e); box-shadow:inset 0 44px 100px -44px #f9731566; border:1px solid #f9731626; }
      .cos-theme-prism { background:linear-gradient(120deg,#12081a,#0a1220); background-size:200% 200%; box-shadow:inset 0 0 90px -18px #a78bfa66; border:1px solid #a78bfa33; animation:cosPrismBg 8s ease infinite; }
      @keyframes cosPrismBg { 0%,100%{ background-position:0% 50%; } 50%{ background-position:100% 50%; } }
      .cos-page-grid { background:radial-gradient(1200px 600px at 50% -10%, #22d3ee1f, transparent 70%), linear-gradient(#ffffff05 1px, transparent 1px) 0 0 / 44px 44px, linear-gradient(90deg, #ffffff05 1px, transparent 1px) 0 0 / 44px 44px, #070709; }
      .cos-page-aurora { background:radial-gradient(900px 600px at 12% 0%, #22d3ee26, transparent 60%), radial-gradient(900px 600px at 88% 8%, #a78bfa26, transparent 60%), radial-gradient(800px 600px at 50% 108%, #f472b61f, transparent 60%), #070709; }
      .cos-page-ember { background:radial-gradient(1100px 600px at 50% -10%, #f973162e, transparent 65%), radial-gradient(700px 500px at 18% 110%, #ea580c1f, transparent 60%), #0a0705; }
      .cos-page-prism { background:linear-gradient(125deg, #0e0820, #0a1424, #0a1220, #140820); background-size:300% 300%; animation:cosPrismBg 14s ease infinite; }
      .cos-theme-watching { background:radial-gradient(circle at 50% 42%, #14141c, #060608 70%); box-shadow:inset 0 0 42px -8px #ff2d2d1f; border:1px solid #ffffff10; }
      .cos-theme-cosmos { background:radial-gradient(120px 90px at 25% 20%, #ff6ec755, transparent 60%), radial-gradient(140px 100px at 80% 35%, #8f6bff55, transparent 62%), linear-gradient(180deg,#0d0620,#0a0416); box-shadow:inset 0 0 40px -10px #b57bff33; border:1px solid #ffffff12; }
      .cos-theme-fallingstars { background:linear-gradient(180deg,#0a1030 0%,#0b1338 55%,#050b1e 60%,#03071a 100%); box-shadow:inset 0 14px 40px -18px #cfe4ff44; border:1px solid #ffffff12; }
      .cos-theme-lucky { background:radial-gradient(80px 60px at 25% 25%, #a8e6b066, transparent 60%), radial-gradient(90px 70px at 75% 35%, #ffb3d166, transparent 62%), radial-gradient(90px 80px at 50% 95%, #cbb6ff55, transparent 60%), linear-gradient(180deg,#151029,#100b20); border:1px solid #ffffff12; }
      .cos-theme-rawr { background:radial-gradient(80px 60px at 25% 30%, #ff2d9566, transparent 60%), radial-gradient(80px 70px at 78% 70%, #5cff5c55, transparent 62%), linear-gradient(140deg,#16001b,#1c0014); box-shadow:inset 0 0 30px -8px #ff2d9533; border:1px solid #ffffff12; }
      .cos-theme-zen { background:radial-gradient(60px 50px at 68% 28%, #bfe6ffcc, transparent 62%), radial-gradient(70px 60px at 80% 75%, #ff3b6b44, transparent 62%), linear-gradient(180deg,#060a1a,#0a1030 55%,#120a26); box-shadow:inset 0 0 30px -10px #7ff0ff33; border:1px solid #ffffff12; }
      /* themed avatar frames */
      .cos-frame-watching { border-radius:9999px; animation:cosFrWatch 3.5s ease-in-out infinite; }
      @keyframes cosFrWatch { 0%,100%{box-shadow:0 0 0 2px #6a5a3a,0 0 10px #ffd47a66} 50%{box-shadow:0 0 0 2px #8a7a4a,0 0 22px #fff6d8cc} }
      .cos-frame-cosmos { border-radius:9999px; animation:cosFrCosmos 3s ease-in-out infinite; }
      @keyframes cosFrCosmos { 0%,100%{box-shadow:0 0 0 2px #ff6ec7,0 0 16px #ff6ec799} 50%{box-shadow:0 0 0 2px #8f6bff,0 0 20px #8f6bffcc} }
      .cos-frame-stars { border-radius:9999px; animation:cosFrStars 2.6s ease-in-out infinite; }
      @keyframes cosFrStars { 0%,100%{box-shadow:0 0 0 2px #bcd8ff,0 0 10px #9fc4ff66} 50%{box-shadow:0 0 0 2px #eaf4ff,0 0 22px #cfe4ffdd} }
      .cos-frame-lucky { border-radius:9999px; animation:cosFrLucky 4.2s ease-in-out infinite; }
      @keyframes cosFrLucky { 0%,100%{box-shadow:0 0 0 2px #a8e6b0,0 0 14px #a8e6b099} 33%{box-shadow:0 0 0 2px #ffb3d1,0 0 16px #ffb3d199} 66%{box-shadow:0 0 0 2px #cbb6ff,0 0 16px #cbb6ff99} }
      .cos-frame-rawr { border-radius:9999px; animation:cosFrRawr 0.9s steps(2,end) infinite; }
      @keyframes cosFrRawr { 0%,100%{box-shadow:0 0 0 2px #ff2d95,0 0 16px #ff2d95cc} 50%{box-shadow:0 0 0 2px #66ff66,0 0 16px #66ff66cc} }
      .cos-frame-zen { border-radius:9999px; animation:cosFrZen 4s steps(1,end) infinite; }
      @keyframes cosFrZen { 0%,88%,100%{box-shadow:0 0 0 2px #7ff0ff,0 0 12px #7ff0ff99} 90%{box-shadow:-2px 0 0 2px #ff3b6b, 2px 0 0 2px #7ff0ff, 0 0 16px #7ff0ff} 92%{box-shadow:0 0 0 2px #7ff0ff,0 0 12px #7ff0ff99} }
      /* themed name styles */
      .cos-name-watching { color:#fff6d8 !important; text-shadow:0 0 10px #ffd47a99; }
      .cos-name-cosmos { background:linear-gradient(90deg,#ff6ec7,#b57bff,#8f6bff,#ff6ec7); background-size:200% auto; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; animation:cosPrism 5s linear infinite; }
      .cos-name-stars { color:#eaf4ff !important; text-shadow:0 0 10px #9fc4ffaa; }
      .cos-name-lucky { background:linear-gradient(90deg,#a8e6b0,#ffb3d1,#cbb6ff,#a8e6b0); background-size:200% auto; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; animation:cosPrism 6s linear infinite; }
      .cos-name-rawr { color:#ff2d95 !important; text-shadow:0 0 8px #66ff6699, 0 0 12px #ff2d9599; }
      .cos-name-zen { color:#7ff0ff !important; text-shadow:1.5px 0 #ff3b6baa, -1.5px 0 #7ff0ffaa, 0 0 10px #7ff0ff66; }
      .cos-page-watching { background:radial-gradient(1000px 720px at 50% 40%, #0b0b13 0%, #060608 55%, #030304 100%), #030304; }
      .cos-page-watching::before, .cos-page-watching::after { content:''; position:fixed; left:50%; top:44%; width:5px; height:7px; border-radius:50%; background:#ffe9c8; transform:translate(-50%,-50%); pointer-events:none; }
      .cos-page-watching::before { box-shadow:-260px -90px 5px 1px #fff2d0, -244px -90px 5px 1px #fff2d0, 210px -50px 5px 1px #ffd6d6, 226px -50px 5px 1px #ffd6d6, -150px 130px 5px 1px #fff2d0, -134px 130px 5px 1px #fff2d0, 300px 170px 5px 1px #ffd6d6, 316px 170px 5px 1px #ffd6d6; animation:cosWatchA 5.5s infinite; }
      .cos-page-watching::after { box-shadow:60px -180px 5px 1px #ffe9c8, 76px -180px 5px 1px #ffe9c8, -340px 60px 5px 1px #ffdada, -324px 60px 5px 1px #ffdada, 150px 250px 5px 1px #ffe9c8, 166px 250px 5px 1px #ffe9c8, -60px -40px 5px 1px #ffdada, -44px -40px 5px 1px #ffdada; animation:cosWatchB 7s infinite; }
      @keyframes cosWatchA { 0%,6%,100%{opacity:.9} 3%{opacity:.06} 49%,53%{opacity:.9} 51%{opacity:.06} }
      @keyframes cosWatchB { 0%,100%{opacity:.75} 28%{opacity:.06} 31%{opacity:.75} 68%{opacity:.75} 71%{opacity:.06} 74%{opacity:.75} }
    `}</style>
  );
}

const FRAME: Record<string, string> = {
  frame_gold: 'cos-frame-gold',
  frame_neon: 'cos-frame-neon',
  frame_ember: 'cos-frame-ember',
  frame_rainbow: 'cos-frame-rainbow',
  frame_watching: 'cos-frame-watching',
  frame_cosmos: 'cos-frame-cosmos',
  frame_stars: 'cos-frame-stars',
  frame_lucky: 'cos-frame-lucky',
  frame_rawr: 'cos-frame-rawr',
  frame_zen: 'cos-frame-zen',
};
const NAME: Record<string, string> = {
  name_gold: 'cos-name-gold',
  name_prism: 'cos-name-prism',
  name_glitch: 'cos-name-glitch',
  name_watching: 'cos-name-watching',
  name_cosmos: 'cos-name-cosmos',
  name_stars: 'cos-name-stars',
  name_lucky: 'cos-name-lucky',
  name_rawr: 'cos-name-rawr',
  name_zen: 'cos-name-zen',
};
const THEME: Record<string, string> = {
  theme_grid: 'cos-theme-grid',
  theme_aurora: 'cos-theme-aurora',
  theme_ember: 'cos-theme-ember',
  theme_prism: 'cos-theme-prism',
  theme_watching: 'cos-theme-watching',
  theme_cosmos: 'cos-theme-cosmos',
  theme_fallingstars: 'cos-theme-fallingstars',
  theme_lucky: 'cos-theme-lucky',
  theme_rawr: 'cos-theme-rawr',
  theme_zen: 'cos-theme-zen',
};

export function frameClass(id?: string | null) {
  return id ? FRAME[id] || '' : '';
}
export function nameClass(id?: string | null) {
  return id ? NAME[id] || '' : '';
}
export function themeClass(id?: string | null) {
  return id ? THEME[id] || '' : '';
}

const PAGE_THEME: Record<string, string> = {
  theme_grid: 'cos-page-grid',
  theme_aurora: 'cos-page-aurora',
  theme_ember: 'cos-page-ember',
  theme_prism: 'cos-page-prism',
  theme_watching: 'cos-page-watching',
};
export function pageThemeClass(id?: string | null) {
  return id ? PAGE_THEME[id] || '' : '';
}

// Reusable client hook: batch-fetch equipped name styles by accountId and apply them.
export function useNameStyles() {
  const known = useRef<Set<string>>(new Set());
  const [styles, setStyles] = useState<Record<string, string | null>>({});
  const [frames, setFrames] = useState<Record<string, string | null>>({});
  const ensure = useCallback(async (ids: (number | null | undefined)[]) => {
    const need = Array.from(new Set(ids.filter((x): x is number => typeof x === 'number'))).map(String).filter((k) => !known.current.has(k));
    if (need.length === 0) return;
    need.forEach((k) => known.current.add(k));
    try {
      const r = await fetch(`/api/economy?names=${need.join(',')}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : { styles: {}, frames: {} };
      setStyles((prev) => ({ ...prev, ...(d.styles || {}) }));
      setFrames((prev) => ({ ...prev, ...(d.frames || {}) }));
    } catch {
      need.forEach((k) => known.current.delete(k));
    }
  }, []);
  const styleOf = useCallback((accId: number | null | undefined) => nameClass(styles[String(accId)]), [styles]);
  const frameOf = useCallback((accId: number | null | undefined) => frameClass(frames[String(accId)]), [frames]);
  return { ensure, styleOf, frameOf };
}
