const ELO = {
  DEFAULT: 1000,
  K_PROVISIONAL: 40,   // first 10 games
  K_STANDARD: 25,
  K_HIGH: 15,          // rating >= 2000
  PROVISIONAL_GAMES: 10,
  HIGH_THRESHOLD: 2000,
  FLOOR: 100,
};

function expectedScore(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

function kFactor(rating, gamesPlayed) {
  if (gamesPlayed < ELO.PROVISIONAL_GAMES) return ELO.K_PROVISIONAL;
  if (rating >= ELO.HIGH_THRESHOLD) return ELO.K_HIGH;
  return ELO.K_STANDARD;
}

// teamA / teamB: arrays of { discordId, elo, gamesPlayed }
// returns discordId -> { oldElo, newElo, delta }
function applyMatchResult(teamA, teamB, winner) {
  const out = {};
  if (teamA.length === 0 || teamB.length === 0) {
    [...teamA, ...teamB].forEach((p) => {
      out[p.discordId] = { oldElo: p.elo, newElo: p.elo, delta: 0 };
    });
    return out;
  }
  const avg = (t) => t.reduce((s, p) => s + p.elo, 0) / t.length;
  const avgA = avg(teamA);
  const avgB = avg(teamB);

  const process = (team, oppAvg, won) => {
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

module.exports = { ELO, expectedScore, kFactor, applyMatchResult };
