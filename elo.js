/**
 * elo.js — singura sursa de adevar pentru calculul ELO (Exquisite COPS)
 *
 * Folosit de bot:  const elo = require('./elo')
 * Math pur: fara DB, fara Discord -> usor de testat si de reutilizat.
 *
 * Principiu:
 *   - "Cat castigi" depinde de adversar prin SCORUL ASTEPTAT (expected score).
 *   - K-factor controleaza VITEZA de convergenta (mare la inceput, mic in top).
 *   - 5v5: se foloseste media ELO pe echipa pentru scorul asteptat,
 *     iar fiecare jucator primeste +/- K * (S - E) al echipei sale.
 */

const ELO = {
  DEFAULT: 1000,          // ELO de start (cont nou)
  FLOOR: 100,             // nu coboara niciodata sub atat
  PROVISIONAL_GAMES: 10,  // cate meciuri sunt "provizorii"
  K_PROVISIONAL: 40,      // converge rapid in primele meciuri
  K_STANDARD: 25,         // ritmul normal
  K_HIGH: 15,             // stabilitate pentru ELO mare
  HIGH_THRESHOLD: 2000,   // de la ce ELO se aplica K_HIGH
};

/** Probabilitatea ca `rating` sa bata `opponentRating` (0..1). */
function expectedScore(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

/** K-factor pentru un jucator, in functie de ELO si meciuri jucate. */
function kFactor(rating, gamesPlayed) {
  if (gamesPlayed < ELO.PROVISIONAL_GAMES) return ELO.K_PROVISIONAL;
  if (rating >= ELO.HIGH_THRESHOLD) return ELO.K_HIGH;
  return ELO.K_STANDARD;
}

/**
 * Update 1v1.
 * @returns { newRating, delta, expected, k }
 */
function updateOne({ rating, gamesPlayed, opponentRating, won }) {
  const expected = expectedScore(rating, opponentRating);
  const k = kFactor(rating, gamesPlayed);
  const delta = Math.round(k * ((won ? 1 : 0) - expected));
  const newRating = Math.max(ELO.FLOOR, rating + delta);
  return { newRating, delta: newRating - rating, expected, k };
}

/**
 * Update 5v5 (sau NvN).
 * @param {Array<{id:any, rating:number, gamesPlayed:number}>} teamA
 * @param {Array<{id:any, rating:number, gamesPlayed:number}>} teamB
 * @param {'A'|'B'} winner
 * @returns { teamA:[...], teamB:[...], meta:{avgA,avgB,expectedA,expectedB} }
 */
function updateMatch(teamA, teamB, winner) {
  const avg = (t) => t.reduce((s, p) => s + p.rating, 0) / t.length;
  const avgA = avg(teamA);
  const avgB = avg(teamB);
  const expectedA = expectedScore(avgA, avgB);
  const expectedB = 1 - expectedA;
  const aWon = winner === 'A';

  const apply = (team, teamExpected, teamWon) =>
    team.map((p) => {
      const k = kFactor(p.rating, p.gamesPlayed);
      const delta = Math.round(k * ((teamWon ? 1 : 0) - teamExpected));
      const newRating = Math.max(ELO.FLOOR, p.rating + delta);
      return {
        id: p.id,
        oldRating: p.rating,
        newRating,
        delta: newRating - p.rating,
        k,
      };
    });

  return {
    teamA: apply(teamA, expectedA, aWon),
    teamB: apply(teamB, expectedB, !aWon),
    meta: { avgA, avgB, expectedA, expectedB },
  };
}

module.exports = { ELO, expectedScore, kFactor, updateOne, updateMatch };
