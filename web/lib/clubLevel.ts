// Club XP is derived from members' aggregate wins; clubs level up on a rising curve.

const BASE = 300; // XP needed for level 2
const GROWTH = 1.25; // each level needs 25% more than the last

export function clubXpFromWins(totalWins: number): number {
  return Math.max(0, Math.round(totalWins)) * 100;
}

export function clubLevelFromXp(xp: number): { level: number; xpInLevel: number; xpForNext: number; progress: number; totalXp: number } {
  let level = 1;
  let need = BASE;
  let remaining = Math.max(0, Math.round(xp));
  while (remaining >= need) {
    remaining -= need;
    level++;
    need = Math.round(need * GROWTH);
  }
  return {
    level,
    xpInLevel: remaining,
    xpForNext: need,
    progress: need > 0 ? Math.min(1, remaining / need) : 0,
    totalXp: Math.max(0, Math.round(xp)),
  };
}
