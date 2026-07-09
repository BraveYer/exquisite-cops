// Shared sanction enforcement: checks for an active mute/ban and formats a message.

export async function activeSanction(db: any, discordId: string, types: string[]) {
  if (!discordId) return null;
  const now = new Date();
  const s = await db.collection('sanctions').findOne(
    {
      discordId,
      type: { $in: types },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    { sort: { createdAt: -1 } }
  );
  return s || null;
}

export function sanctionMessage(s: any): string {
  const verb = s?.type === 'ban' ? 'banned' : 'muted';
  const until = s?.expiresAt ? ` until ${new Date(s.expiresAt).toLocaleString()}` : '';
  return `You are ${verb}${until}${s?.reason ? `: ${s.reason}` : ''}`;
}

// Backwards-compatible aliases (older code used the "silence" naming).
export async function activeSilence(db: any, discordId: string) {
  return activeSanction(db, discordId, ['mute', 'ban']);
}
export function silenceMessage(s: any): string {
  return sanctionMessage(s);
}