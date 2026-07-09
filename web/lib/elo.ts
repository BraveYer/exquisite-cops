export const ELO = {
  DEFAULT: 1000,
  K_PROVISIONAL: 40,   // first 10 games
  K_STANDARD: 25,
  K_HIGH: 15,          // rating >= 2000
  PROVISIONAL_GAMES: 10,
  HIGH_THRESHOLD: 2000,
  FLOOR: 100,
};

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

export function kFactor(rating: number, gamesPlayed: number): number {
  if (gamesPlayed < ELO.PROVISIONAL_GAMES) return ELO.K_PROVISIONAL;
  if (rating >= ELO.HIGH_THRESHOLD) return ELO.K_HIGH;
  return ELO.K_STANDARD;
}

export type EloPlayer = { discordId: string; elo: number; gamesPlayed: number };
export type EloDelta = { oldElo: number; newElo: number; delta: number };

// Returns discordId -> { oldElo, newElo, delta } for everyone in both teams.
export function applyMatchResult(
  teamA: EloPlayer[],
  teamB: EloPlayer[],
  winner: 'A' | 'B'
): Record<string, EloDelta> {
  const out: Record<string, EloDelta> = {};

  // Cannot rate a match with an empty side (e.g. a solo test) — no ELO change.
  if (teamA.length === 0 || teamB.length === 0) {
    [...teamA, ...teamB].forEach((p) => {
      out[p.discordId] = { oldElo: p.elo, newElo: p.elo, delta: 0 };
    });
    return out;
  }

  const avg = (t: EloPlayer[]) => t.reduce((s, p) => s + p.elo, 0) / t.length;
  const avgA = avg(teamA);
  const avgB = avg(teamB);

  const process = (team: EloPlayer[], oppAvg: number, won: boolean) => {
    team.forEach((p) => {
      const expected = expectedScore(p.elo, oppAvg);
      const score = won ? 1 : 0;
      const k = kFactor(p.elo, p.gamesPlayed);
      let newElo = Math.round(p.elo + k * (score - expected));
      if (newElo < ELO.FLOOR) newElo = ELO.FLOOR;
      out[p.discordId] = { oldElo: p.elo, newElo, delta: newElo - p.elo };
    });
  };

  process(teamA, avgB, winner === 'A');
  process(teamB, avgA, winner === 'B');
  return out;
}
