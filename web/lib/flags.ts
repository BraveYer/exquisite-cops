// Feature flags — toggled from the admin panel, no redeploy needed.

export type FlagDef = { key: string; label: string; desc?: string; default: boolean };

export const FLAGS: FlagDef[] = [
  { key: 'matchmaking', label: 'Matchmaking', desc: 'Ranked queue & drafts', default: true },
  { key: 'tournaments', label: 'Tournaments', desc: 'Bracket events', default: true },
  { key: 'clubs', label: 'Clubs', desc: 'Club org & chat', default: true },
  { key: 'shop', label: 'Shop & Economy', desc: 'EP, cosmetics, packs', default: true },
  { key: 'battlepass', label: 'Battle Pass', desc: 'Seasonal pass', default: true },
  { key: 'feed', label: 'Community Feed', desc: 'Posts & activity', default: true },
  { key: 'messages', label: 'Messages', desc: 'DMs & group chats', default: true },
];

export const FLAG_KEYS = FLAGS.map((f) => f.key);
export const DEFAULT_FLAGS: Record<string, boolean> = Object.fromEntries(FLAGS.map((f) => [f.key, f.default]));

export function mergeFlags(stored?: Record<string, boolean> | null): Record<string, boolean> {
  const out = { ...DEFAULT_FLAGS };
  if (stored) {
    for (const f of FLAGS) if (typeof stored[f.key] === 'boolean') out[f.key] = stored[f.key];
  }
  return out;
}
