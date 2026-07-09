// ELO decay: inactive ranked players slowly lose ELO so the ladder stays fresh.

export const DECAY = {
  graceDays: 14, // no decay until inactive this long
  perWeek: 25, // ELO removed per decay step (applied at most once/week)
  floor: 1000, // never decay below this
  minGames: 1, // only decay players who have actually played
  lookbackDays: 120, // window used to find a player's last match
};
