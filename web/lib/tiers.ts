// Rank divisions derived purely from ELO. No DB changes — rank is always computed.
// Bottom -> top: Challenger (III,II,I) -> Master (III,II,I) -> Grandmaster (III,II,I) -> Exquisite Pro League.
export type Tier = {
  index: number;     // 0-based (0..9); rank shown to players is index + 1
  division: string;  // 'Challenger' | 'Master' | 'Grandmaster' | 'Exquisite Pro League'
  sub: string;       // 'III' | 'II' | 'I' | '' (EPL has no sub-rank)
  name: string;      // full label, e.g. 'Challenger II' or 'Exquisite Pro League'
  glyph: string;     // shown inside the badge ('III'/'II'/'I'); EPL renders a crown instead
  min: number;       // inclusive ELO floor for this rank
  color: string;     // badge top fill
  color2: string;    // badge bottom fill (== color unless special, e.g. EPL gradient)
  glow: string;      // badge glow (rgba)
  text: string;      // glyph color (contrast)
  top?: boolean;     // EPL -> crown badge
};

export const TIERS: Tier[] = [
  { index: 0, division: 'Challenger',   sub: 'III', name: 'Challenger III',       glyph: 'III', min: 0,    color: '#0f766e', color2: '#0f766e', glow: 'rgba(15,118,110,0.55)',  text: '#ffffff' },
  { index: 1, division: 'Challenger',   sub: 'II',  name: 'Challenger II',        glyph: 'II',  min: 900,  color: '#14b8a6', color2: '#14b8a6', glow: 'rgba(20,184,166,0.55)',  text: '#ffffff' },
  { index: 2, division: 'Challenger',   sub: 'I',   name: 'Challenger I',         glyph: 'I',   min: 1100, color: '#5eead4', color2: '#5eead4', glow: 'rgba(94,234,212,0.5)',   text: '#0b0b0f' },
  { index: 3, division: 'Master',       sub: 'III', name: 'Master III',           glyph: 'III', min: 1300, color: '#0369a1', color2: '#0369a1', glow: 'rgba(3,105,161,0.55)',   text: '#ffffff' },
  { index: 4, division: 'Master',       sub: 'II',  name: 'Master II',            glyph: 'II',  min: 1500, color: '#0ea5e9', color2: '#0ea5e9', glow: 'rgba(14,165,233,0.55)',  text: '#ffffff' },
  { index: 5, division: 'Master',       sub: 'I',   name: 'Master I',             glyph: 'I',   min: 1700, color: '#7dd3fc', color2: '#7dd3fc', glow: 'rgba(125,211,252,0.5)',  text: '#0b0b0f' },
  { index: 6, division: 'Grandmaster',  sub: 'III', name: 'Grandmaster III',      glyph: 'III', min: 1900, color: '#7e22ce', color2: '#7e22ce', glow: 'rgba(126,34,206,0.55)',  text: '#ffffff' },
  { index: 7, division: 'Grandmaster',  sub: 'II',  name: 'Grandmaster II',       glyph: 'II',  min: 2100, color: '#a855f7', color2: '#a855f7', glow: 'rgba(168,85,247,0.6)',   text: '#ffffff' },
  { index: 8, division: 'Grandmaster',  sub: 'I',   name: 'Grandmaster I',        glyph: 'I',   min: 2300, color: '#d8b4fe', color2: '#d8b4fe', glow: 'rgba(216,180,254,0.5)',  text: '#0b0b0f' },
  { index: 9, division: 'Exquisite Pro League', sub: '', name: 'Exquisite Pro League', glyph: '', min: 2500, color: '#22d3ee', color2: '#a855f7', glow: 'rgba(34,211,238,0.65)', text: '#ffffff', top: true },
];

export function getTier(elo: number): Tier {
  let current = TIERS[0];
  for (const tier of TIERS) if (elo >= tier.min) current = tier;
  return current;
}

export function getNextTier(elo: number): Tier | null {
  const current = getTier(elo);
  return TIERS[current.index + 1] ?? null;
}

// 0..1 progress toward the next rank; 1 when already at Exquisite Pro League.
export function tierProgress(elo: number): number {
  const current = getTier(elo);
  const next = getNextTier(elo);
  if (!next) return 1;
  return Math.max(0, Math.min(1, (elo - current.min) / (next.min - current.min)));
}
