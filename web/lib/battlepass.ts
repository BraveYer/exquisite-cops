// Battle pass configuration: a season with a free + premium reward track.
// XP is derived from lifetime match activity (see the API), so progress is cumulative.

export const BP_SEASON = { id: 'bp-2026-s1', name: 'Season 1' };
export const XP_PER_TIER = 1000;
export const MAX_TIER = 30;
export const PREMIUM_COST = 2500; // EP to unlock the premium track

// XP granted per completed match / per win (used to derive total XP).
export const XP_PER_GAME = 100;
export const XP_PER_WIN = 150;

export type BpReward = { type: 'ep' | 'cosmetic'; amount?: number; itemId?: string; label: string };
export type BpTier = { tier: number; free: BpReward; premium: BpReward };

// Premium cosmetic rewards at milestone tiers.
const PREMIUM_COSMETIC: Record<number, { id: string; label: string }> = {
  5: { id: 'frame_gold', label: 'Gold Ring' },
  10: { id: 'name_gold', label: 'Golden Name' },
  15: { id: 'frame_neon', label: 'Neon Pulse' },
  20: { id: 'theme_grid', label: 'Neon Grid' },
  25: { id: 'name_prism', label: 'Prism Name' },
  30: { id: 'theme_prism', label: 'Prism Wave' },
};

export const BP_TIERS: BpTier[] = Array.from({ length: MAX_TIER }, (_, i) => {
  const tier = i + 1;
  const freeEp = 40 + (tier % 5 === 0 ? 60 : 0);
  const free: BpReward = { type: 'ep', amount: freeEp, label: `${freeEp} EP` };
  const cos = PREMIUM_COSMETIC[tier];
  const premium: BpReward = cos
    ? { type: 'cosmetic', itemId: cos.id, label: cos.label }
    : { type: 'ep', amount: 90, label: '90 EP' };
  return { tier, free, premium };
});

export function tierFromXp(xp: number) {
  return Math.max(0, Math.min(MAX_TIER, Math.floor(xp / XP_PER_TIER)));
}
