// Escalating queue penalty for dodging a match during draft/veto.

export function dodgePenaltyMinutes(count: number): number {
  if (count <= 1) return 5;
  if (count === 2) return 15;
  if (count === 3) return 30;
  return 60;
}

// Dodge count decays if the last dodge was long ago.
export const DODGE_DECAY_MS = 24 * 60 * 60 * 1000;
