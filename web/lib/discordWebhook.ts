// Posts announcements to a Discord channel via an incoming webhook (best-effort).
// Configure DISCORD_WEBHOOK_URL in the environment to enable.

export async function announceToDiscord(payload: { content?: string; embeds?: any[] }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}

export function siteBase(): string {
  return (process.env.NEXTAUTH_URL || process.env.SITE_URL || '').replace(/\/$/, '');
}
