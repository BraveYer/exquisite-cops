export type SocialKey = 'twitch' | 'youtube' | 'x' | 'instagram' | 'tiktok' | 'kick';

export const SOCIALS: { key: SocialKey; label: string; color: string; placeholder: string }[] = [
  { key: 'twitch',    label: 'Twitch',    color: '#9146ff', placeholder: 'https://twitch.tv/yourname' },
  { key: 'youtube',   label: 'YouTube',   color: '#ff0000', placeholder: 'https://youtube.com/@yourname' },
  { key: 'x',         label: 'X',         color: '#e7e9ea', placeholder: 'https://x.com/yourname' },
  { key: 'instagram', label: 'Instagram', color: '#e1306c', placeholder: 'https://instagram.com/yourname' },
  { key: 'tiktok',    label: 'TikTok',    color: '#ff0050', placeholder: 'https://tiktok.com/@yourname' },
  { key: 'kick',      label: 'Kick',      color: '#53fc18', placeholder: 'https://kick.com/yourname' },
];

export type Socials = Partial<Record<SocialKey, string>>;

// Accept a pasted URL or bare handle/domain; ensure it has a scheme.
export function normalizeUrl(v: string): string {
  const t = (v || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
