// Edit your season prize pool & rewards here — shown on the /season page.
export const SEASON_REWARDS = {
  prizePool: '€100',
  note: 'Awarded at the end of each season to the top of the ladder.',
  tiers: [
    { place: '1st', medal: '🥇', reward: '€50 + Exquisite Pro role' },
    { place: '2nd', medal: '🥈', reward: '€30' },
    { place: '3rd', medal: '🥉', reward: '€20' },
  ] as { place: string; medal: string; reward: string }[],
};
