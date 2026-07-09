// Central catalog for the EP economy: cosmetics, real-money EP packs, and missions.
// EP = "Exquisite Points" — the in-app currency.

export type Rarity = 'uncommon' | 'rare' | 'epic' | 'legendary';
export type CosmeticSlot = 'frame' | 'name' | 'theme';

export type Cosmetic = {
  id: string;
  name: string;
  slot: CosmeticSlot;
  price: number; // in EP
  rarity: Rarity;
  desc: string;
};

export const RARITY_COLOR: Record<Rarity, string> = {
  uncommon: '#34d399',
  rare: '#38bdf8',
  epic: '#a78bfa',
  legendary: '#f59e0b',
};

// Avatar-ring frames + animated name styles. All pure CSS (see ProfileCosmetics).
export const COSMETICS: Cosmetic[] = [
  { id: 'frame_gold', name: 'Gold Ring', slot: 'frame', price: 400, rarity: 'uncommon', desc: 'A clean golden ring around your avatar.' },
  { id: 'frame_neon', name: 'Neon Pulse', slot: 'frame', price: 700, rarity: 'rare', desc: 'A cyan neon ring that pulses.' },
  { id: 'frame_ember', name: 'Ember Aura', slot: 'frame', price: 1000, rarity: 'epic', desc: 'A flickering ember glow.' },
  { id: 'frame_rainbow', name: 'Spectrum Ring', slot: 'frame', price: 1800, rarity: 'legendary', desc: 'A shifting rainbow halo.' },
  { id: 'name_gold', name: 'Golden Name', slot: 'name', price: 500, rarity: 'uncommon', desc: 'A warm golden glow on your name.' },
  { id: 'name_prism', name: 'Prism Name', slot: 'name', price: 900, rarity: 'rare', desc: 'An animated rainbow gradient name.' },
  { id: 'name_glitch', name: 'Glitch Name', slot: 'name', price: 1400, rarity: 'epic', desc: 'A cyberpunk RGB glitch on your name.' },
  { id: 'frame_watching', name: 'Watchful Ring', slot: 'frame', price: 1500, rarity: 'epic', desc: 'An eerie warm glow that watches with you.' },
  { id: 'frame_cosmos', name: 'Cosmic Ring', slot: 'frame', price: 1500, rarity: 'epic', desc: 'A pink-and-purple cosmic halo.' },
  { id: 'frame_stars', name: 'Starfall Ring', slot: 'frame', price: 1500, rarity: 'epic', desc: 'An icy shimmering starlight ring.' },
  { id: 'frame_lucky', name: 'Lucky Ring', slot: 'frame', price: 1500, rarity: 'epic', desc: 'A pastel charm-glow that shifts colors.' },
  { id: 'frame_rawr', name: 'Rawr Ring', slot: 'frame', price: 1500, rarity: 'epic', desc: 'A hot-pink and neon-green flashing ring.' },
  { id: 'frame_zen', name: 'Zen Ring', slot: 'frame', price: 1500, rarity: 'epic', desc: 'A cyan neon ring that glitches.' },
  { id: 'name_watching', name: 'Watchful Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A warm eerie glow on your name.' },
  { id: 'name_cosmos', name: 'Cosmic Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A pink-purple cosmic gradient name.' },
  { id: 'name_stars', name: 'Starfall Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'An icy starlight glow on your name.' },
  { id: 'name_lucky', name: 'Lucky Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A pastel charm gradient name.' },
  { id: 'name_rawr', name: 'Rawr Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'Hot-pink name with a neon-green glow.' },
  { id: 'name_zen', name: 'Zen Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A cyan name with a chromatic split.' },
  { id: 'theme_grid', name: 'Neon Grid', slot: 'theme', price: 700, rarity: 'uncommon', desc: 'A cyan-lit panel behind your profile header.' },
  { id: 'theme_aurora', name: 'Aurora', slot: 'theme', price: 1100, rarity: 'rare', desc: 'A flowing aurora glow on your profile.' },
  { id: 'theme_ember', name: 'Ember Sky', slot: 'theme', price: 1600, rarity: 'epic', desc: 'A smoldering ember backdrop.' },
  { id: 'theme_prism', name: 'Prism Wave', slot: 'theme', price: 2200, rarity: 'legendary', desc: 'A shifting prism aura for your profile.' },
  { id: 'theme_watching', name: 'Always Watching', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'Glowing eyes peer out from the shadows behind your profile.' },
  { id: 'theme_cosmos', name: 'Enchanted Cosmos', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'A dreamy pink-and-purple nebula with planets, bubbles and a rainbow comet.' },
  { id: 'theme_fallingstars', name: 'Falling Stars', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'Glowing stars fall from the night sky and submerge into a dark ocean.' },
  { id: 'theme_lucky', name: 'Lucky Era', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'Glowing pastel hearts, stars, moons and clovers float and sparkle.' },
  { id: 'theme_rawr', name: 'Rawr xD Splash', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'Hot-pink RAWR XD! with lightning and neon-green splatter.' },
  { id: 'theme_zen', name: 'Zen Garden', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'A cybernetic Japanese garden and skyline glitch into view under the moon.' },
];

export function getCosmetic(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}

// Real-money packs. NOTE: purchasing must be gated behind a real payment provider
// (Stripe, etc.) before launch — the demo flow credits EP directly.
export type EpPack = { id: string; ep: number; price: string; usd: number; bonus?: string };
export const EP_PACKS: EpPack[] = [
  { id: 'pack_s', ep: 500, price: '$1.99', usd: 1.99 },
  { id: 'pack_m', ep: 1500, price: '$4.99', usd: 4.99, bonus: '+10% bonus' },
  { id: 'pack_l', ep: 4000, price: '$9.99', usd: 9.99, bonus: '+25% bonus' },
  { id: 'pack_xl', ep: 10000, price: '$19.99', usd: 19.99, bonus: '+40% bonus' },
];

export function getPack(id: string): EpPack | undefined {
  return EP_PACKS.find((p) => p.id === id);
}

// Missions read the player's completed matches in a time window.
export type Mission = {
  id: string;
  type: 'daily' | 'weekly';
  title: string;
  metric: 'games' | 'wins';
  target: number;
  reward: number; // EP
};

export const DAILY_BONUS = 50;

// Supporter tier: buy with EP (a big sink) or staff-granted; monthly EP bonus + a profile badge.
export const SUPPORTER = { costEp: 10000, monthlyEp: 500, days: 30 };

// Daily bonus grows with your claim streak (+10 per consecutive day, capped).
export function dailyReward(streak: number) {
  return DAILY_BONUS + Math.min(Math.max(streak, 1) - 1, 6) * 10;
}

export const MISSIONS: Mission[] = [
  { id: 'play_daily', type: 'daily', title: 'Play a match today', metric: 'games', target: 1, reward: 30 },
  { id: 'play3_daily', type: 'daily', title: 'Play 3 matches today', metric: 'games', target: 3, reward: 70 },
  { id: 'win_daily', type: 'daily', title: 'Win a match today', metric: 'wins', target: 1, reward: 60 },
  { id: 'win2_daily', type: 'daily', title: 'Win 2 matches today', metric: 'wins', target: 2, reward: 120 },
  { id: 'play_weekly', type: 'weekly', title: 'Play 5 matches this week', metric: 'games', target: 5, reward: 150 },
  { id: 'play10_weekly', type: 'weekly', title: 'Play 10 matches this week', metric: 'games', target: 10, reward: 300 },
  { id: 'win_weekly', type: 'weekly', title: 'Win 3 matches this week', metric: 'wins', target: 3, reward: 250 },
  { id: 'win7_weekly', type: 'weekly', title: 'Win 7 matches this week', metric: 'wins', target: 7, reward: 500 },
];

// One-time career achievements, computed from lifetime stats.
export type AchievementKind = 'wins' | 'games' | 'elo' | 'tournamentWins' | 'inClub' | 'friends' | 'cosmetics';
export type Achievement = { id: string; title: string; desc: string; kind: AchievementKind; target: number; reward: number };

export const ACHIEVEMENTS: Achievement[] = [
  // Wins
  { id: 'ach_first_win', title: 'First Blood', desc: 'Win your first match', kind: 'wins', target: 1, reward: 50 },
  { id: 'ach_10_wins', title: 'Contender', desc: 'Win 10 matches', kind: 'wins', target: 10, reward: 150 },
  { id: 'ach_25_wins', title: 'Sharpshooter', desc: 'Win 25 matches', kind: 'wins', target: 25, reward: 300 },
  { id: 'ach_50_wins', title: 'Veteran', desc: 'Win 50 matches', kind: 'wins', target: 50, reward: 500 },
  { id: 'ach_250_wins', title: 'Warlord', desc: 'Win 250 matches', kind: 'wins', target: 250, reward: 1500 },
  // Games played
  { id: 'ach_25_games', title: 'Getting Started', desc: 'Play 25 matches', kind: 'games', target: 25, reward: 100 },
  { id: 'ach_100_games', title: 'Centurion', desc: 'Play 100 matches', kind: 'games', target: 100, reward: 300 },
  { id: 'ach_500_games', title: 'Marathoner', desc: 'Play 500 matches', kind: 'games', target: 500, reward: 1000 },
  // ELO / rank
  { id: 'ach_ascend', title: 'Ascendant', desc: 'Reach 1300 ELO', kind: 'elo', target: 1300, reward: 500 },
  { id: 'ach_master', title: 'Master', desc: 'Reach 1700 ELO', kind: 'elo', target: 1700, reward: 1000 },
  { id: 'ach_grandmaster', title: 'Grandmaster', desc: 'Reach 2100 ELO', kind: 'elo', target: 2100, reward: 2000 },
  { id: 'ach_pro', title: 'Pro League', desc: 'Reach 2500 ELO', kind: 'elo', target: 2500, reward: 5000 },
  // Tournaments
  { id: 'ach_champion', title: 'Champion', desc: 'Win a tournament', kind: 'tournamentWins', target: 1, reward: 1000 },
  { id: 'ach_dynasty', title: 'Dynasty', desc: 'Win 3 tournaments', kind: 'tournamentWins', target: 3, reward: 3000 },
  // Social & collection
  { id: 'ach_club', title: 'Belonging', desc: 'Join a club', kind: 'inClub', target: 1, reward: 100 },
  { id: 'ach_squad', title: 'Squad Up', desc: 'Have 5 friends', kind: 'friends', target: 5, reward: 150 },
  { id: 'ach_collector', title: 'Collector', desc: 'Own 5 cosmetics', kind: 'cosmetics', target: 5, reward: 500 },
];
