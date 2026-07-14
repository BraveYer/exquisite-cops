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
  from?: string;  // ISO date — not purchasable before this
  until?: string; // ISO date — not purchasable after this (owners keep it)
};

// Seasonal availability: an item with a `from`/`until` window is only buyable
// inside that window. Owners keep expired items forever — they just can't be
// bought once the window closes.
export function isAvailable(item: { from?: string; until?: string }, now: number = Date.now()): boolean {
  if (item.from && now < Date.parse(item.from)) return false;
  if (item.until && now > Date.parse(item.until)) return false;
  return true;
}

// Seconds until the item leaves the shop (or null if it has no end date / already ended).
export function secondsLeft(item: { until?: string }, now: number = Date.now()): number | null {
  if (!item.until) return null;
  const diff = Math.floor((Date.parse(item.until) - now) / 1000);
  return diff > 0 ? diff : null;
}

export function isSeasonal(item: { from?: string; until?: string }): boolean {
  return !!(item.from || item.until);
}

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
  { id: 'frame_sheep', name: 'Starlit', slot: 'frame', price: 1500, rarity: 'epic', desc: 'A pink-and-yellow crescent moon with scattered stars.' },
  { id: 'frame_stage_orange', name: 'Spotlight — Orange', slot: 'frame', price: 1500, rarity: 'epic', desc: 'A gold ring pulsing with warm orange stage light.' },
  { id: 'frame_stage_teal', name: 'Spotlight — Teal', slot: 'frame', price: 1500, rarity: 'epic', desc: 'A gold ring pulsing with cool teal stage light.' },
  { id: 'frame_random', name: 'so random ring', slot: 'frame', price: 1500, rarity: 'epic', desc: 'A chaotic ring flashing neon pink, lime, cyan and yellow.', until: '2026-08-15' },
  { id: 'name_watching', name: 'Watchful Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A warm eerie glow on your name.' },
  { id: 'name_cosmos', name: 'Cosmic Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A pink-purple cosmic gradient name.' },
  { id: 'name_stars', name: 'Starfall Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'An icy starlight glow on your name.' },
  { id: 'name_lucky', name: 'Lucky Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A pastel charm gradient name.' },
  { id: 'name_rawr', name: 'Rawr Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'Hot-pink name with a neon-green glow.' },
  { id: 'name_zen', name: 'Zen Name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A cyan name with a chromatic split.' },
  { id: 'name_sheep', name: 'Moon Bloom', slot: 'name', price: 1200, rarity: 'epic', desc: 'A pink-and-magenta gradient with a dreamy moon glow.' },
  { id: 'name_stage_orange', name: 'Encore — Orange', slot: 'name', price: 1200, rarity: 'epic', desc: 'A shimmering gold-to-orange stage-light gradient.' },
  { id: 'name_stage_teal', name: 'Encore — Teal', slot: 'name', price: 1200, rarity: 'epic', desc: 'A shimmering gold-to-teal stage-light gradient.' },
  { id: 'name_random', name: 'xP name', slot: 'name', price: 1200, rarity: 'epic', desc: 'A chaotic neon rainbow that never sits still.', until: '2026-08-15' },
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
  { id: 'theme_sheep', name: 'Counting Sheep', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'Fluffy sheep leap across a starry meadow under a pink-and-yellow crescent moon.' },
  { id: 'theme_stage_orange', name: 'Every Profile is a Stage — Orange', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'Crossing spotlights and shimmering gold & orange glitter scatter across a stage.' },
  { id: 'theme_stage_teal', name: 'Every Profile is a Stage — Teal', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'Crossing spotlights and shimmering gold & teal glitter scatter across a stage.' },
  { id: 'theme_random', name: 'hehe so random xP', slot: 'theme', price: 3000, rarity: 'legendary', desc: 'A black & white checkerboard swarming with chaotic cat skulls, hearts, stars and bolts.', until: '2026-08-15' },
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

// Cosmetic bundles — a themed set (theme + frame + name) sold together at a
// discount. Buyable with EP or with cash (PayPal).
export type Bundle = { id: string; name: string; desc: string; items: string[]; ep: number; usd: number; rarity: Rarity; from?: string; until?: string };
export const BUNDLES: Bundle[] = [
  { id: 'bundle_watching', name: 'Always Watching Set', desc: 'Theme + frame + name style — the full eerie set.', items: ['theme_watching', 'frame_watching', 'name_watching'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_cosmos', name: 'Enchanted Cosmos Set', desc: 'Theme + frame + name style — pink & purple cosmos.', items: ['theme_cosmos', 'frame_cosmos', 'name_cosmos'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_stars', name: 'Falling Stars Set', desc: 'Theme + frame + name style — icy starfall.', items: ['theme_fallingstars', 'frame_stars', 'name_stars'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_lucky', name: 'Lucky Era Set', desc: 'Theme + frame + name style — pastel charms.', items: ['theme_lucky', 'frame_lucky', 'name_lucky'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_rawr', name: 'Rawr xD Set', desc: 'Theme + frame + name style — neon chaos.', items: ['theme_rawr', 'frame_rawr', 'name_rawr'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_zen', name: 'Zen Garden Set', desc: 'Theme + frame + name style — cyber-zen.', items: ['theme_zen', 'frame_zen', 'name_zen'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_sheep', name: 'Moon Meadow Bundle', desc: 'Counting Sheep theme + Starlit frame + Moon Bloom name.', items: ['theme_sheep', 'frame_sheep', 'name_sheep'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_stage_orange', name: 'Center Stage — Orange', desc: 'Stage theme + Spotlight frame + Encore name (orange).', items: ['theme_stage_orange', 'frame_stage_orange', 'name_stage_orange'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_stage_teal', name: 'Center Stage — Teal', desc: 'Stage theme + Spotlight frame + Encore name (teal).', items: ['theme_stage_teal', 'frame_stage_teal', 'name_stage_teal'], ep: 4500, usd: 6.99, rarity: 'legendary' },
  { id: 'bundle_random', name: 'so random Bundle xP', desc: 'so random theme + ring frame + xP name.', items: ['theme_random', 'frame_random', 'name_random'], ep: 4500, usd: 6.99, rarity: 'legendary', until: '2026-08-15' },
];

export function getBundle(id: string): Bundle | undefined {
  return BUNDLES.find((b) => b.id === id);
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

// ── Daily shop rotation ──────────────────────────────────────────────
// A deterministic set of cosmetics discounted each day (UTC). Everyone sees
// the same rotation; it changes at UTC midnight.
export const DAILY_DEAL_COUNT = 4;
export const DAILY_DISCOUNT = 0.25; // 25% off

function _dealHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyDeals(now: number = Date.now()): { id: string; price: number; orig: number }[] {
  const pool = COSMETICS.filter((c) => isAvailable(c, now));
  if (pool.length === 0) return [];
  let s = _dealHash(new Date(now).toISOString().slice(0, 10)) || 1;
  const used = new Set<number>();
  const out: { id: string; price: number; orig: number }[] = [];
  const target = Math.min(DAILY_DEAL_COUNT, pool.length);
  let guard = 0;
  while (out.length < target && guard++ < 500) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const idx = s % pool.length;
    if (used.has(idx)) continue;
    used.add(idx);
    const c = pool[idx];
    out.push({ id: c.id, orig: c.price, price: Math.max(10, Math.round((c.price * (1 - DAILY_DISCOUNT)) / 10) * 10) });
  }
  return out;
}

export function dealPrice(id: string, now: number = Date.now()): number | null {
  const d = dailyDeals(now).find((x) => x.id === id);
  return d ? d.price : null;
}

export function dailyResetSeconds(now: number = Date.now()): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
  return Math.max(0, Math.floor((next - now) / 1000));
}
