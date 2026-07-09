import { notify } from './notify';

// Pull @name tokens out of a message (letters/digits/underscore, 2-20 chars).
export function extractMentions(text: string): string[] {
  const set = new Set<string>();
  const re = /@([A-Za-z0-9_]{2,20})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(m[1].toLowerCase());
  return Array.from(set).slice(0, 10);
}

// Resolve @mentions to players and drop each a notification (best-effort, never throws).
export async function notifyMentions(
  db: any,
  text: string,
  opts: { fromName: string; link: string; scopeLabel: string; excludeDiscordId?: string; allowedDiscordIds?: string[] | null }
) {
  try {
    const tokens = extractMentions(text);
    if (tokens.length === 0) return;
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const players = await db
      .collection('players')
      .find({ $or: tokens.map((t) => ({ copsName: new RegExp('^' + esc(t) + '$', 'i') })) }, { projection: { discordId: 1 } })
      .limit(10)
      .toArray();
    const allow = opts.allowedDiscordIds ? new Set(opts.allowedDiscordIds) : null;
    const seen = new Set<string>();
    for (const p of players as any[]) {
      if (!p.discordId || p.discordId === opts.excludeDiscordId || seen.has(p.discordId)) continue;
      if (allow && !allow.has(p.discordId)) continue;
      seen.add(p.discordId);
      notify(db, p.discordId, {
        type: 'mention',
        title: 'You were mentioned',
        body: `${opts.fromName} mentioned you in ${opts.scopeLabel}`,
        link: opts.link,
      });
    }
  } catch {
    /* ignore */
  }
}
